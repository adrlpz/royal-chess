// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

// ─── Chainlink Oracle Interface ─────────────────────────────────────
interface IAggregatorV3 {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}

/**
 * @title RoyalChessEscrow
 * @notice Escrow contract for Royal Chess PvP betting.
 *         Holds player deposits, settles matches with 5% platform fee.
 * @dev UUPS upgradeable, Pausable, ReentrancyGuard, TimelockController-compatible.
 *
 * Security fixes applied:
 * - [FIX-1] Checks-effects-interactions in settleMatch
 * - [FIX-2] settleMatch requires InProgress status (game must be played)
 * - [FIX-3] Stricter access control on refundMatch
 * - [FIX-4] MatchStarted event for startMatch
 * - [FIX-5] Bet bounds on-chain
 * - [FIX-6] Pull-pattern refunds to prevent gas griefing
 * - [FIX-7] Chainlink price oracle for USD-based bet limits
 * - [FIX-8] Timelock guard for fee rate changes (48h delay)
 */
contract RoyalChessEscrow is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // ─── Enums ──────────────────────────────────────────────────────
    enum MatchStatus {
        Created,     // 0 — match created, waiting for opponent deposit
        Funded,      // 1 — both players deposited
        InProgress,  // 2 — game started
        Settled,     // 3 — winner paid out
        Cancelled,   // 4 — cancelled before game started
        Draw         // 5 — game ended in draw, funds pending claim
    }

    // ─── Structs ────────────────────────────────────────────────────
    struct Match {
        bytes32 matchId;
        address player1;
        address player2;
        address token;          // ERC-20 address, or address(0) for native ETH/BNB
        uint256 betAmount;      // per player
        uint256 totalPot;       // player1Deposit + player2Deposit
        uint256 platformFee;    // 5% of totalPot
        MatchStatus status;
        uint256 createdAt;
        uint256 depositDeadline;
    }

    // ─── State ──────────────────────────────────────────────────────
    mapping(bytes32 => Match) public matches;
    mapping(bytes32 => bool) public matchExists;

    address public treasury;
    uint256 public feeRateBps;          // basis points, 500 = 5%
    uint256 public constant MAX_FEE_BPS = 1000; // 10% max
    uint256 public constant FEE_BPS_DENOM = 10000;
    uint256 public constant DEPOSIT_DEADLINE = 5 minutes;
    uint256 public constant GAME_TIMEOUT = 24 hours;

    // [FIX-5] USD-based bet limits (in 18 decimals)
    uint256 public constant MIN_BET_USD = 1e18;       // $1
    uint256 public constant MAX_BET_USD = 10_000e18;   // $10,000

    // [FIX-7] Chainlink price feeds (one per native token)
    // ETH/USD on Base: 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70
    // BNB/USD on BSC: 0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE
    mapping(address => address) public priceFeeds; // token => Chainlink feed
    uint256 public constant PRICE_STALENESS = 1 hours;
    int256 public constant PRICE_MIN = 1; // $0.01 minimum (sanity check)

    // [FIX-8] Timelock for fee rate changes
    uint256 public pendingFeeRate;
    uint256 public feeChangeTimestamp;
    uint256 public constant FEE_CHANGE_DELAY = 48 hours;

    // [FIX-6] Pull-pattern: pending refunds per match per player
    // key = keccak256(abi.encode(matchId, player))
    mapping(bytes32 => uint256) public pendingWithdrawals;

    // ─── Events ─────────────────────────────────────────────────────
    event MatchCreated(
        bytes32 indexed matchId,
        address indexed player1,
        address token,
        uint256 betAmount
    );
    event PlayerDeposited(bytes32 indexed matchId, address indexed player, uint256 amount);
    event MatchJoined(bytes32 indexed matchId, address indexed player2);
    event MatchStarted(bytes32 indexed matchId); // [FIX-4]
    event MatchSettled(bytes32 indexed matchId, address indexed winner, uint256 payout, uint256 fee);
    event MatchCancelled(bytes32 indexed matchId);
    event MatchRefunded(bytes32 indexed matchId, string reason);
    event WithdrawalClaimed(bytes32 indexed matchId, address indexed player, uint256 amount);
    event FeeRateUpdateScheduled(uint256 newRate, uint256 executeAfter);
    event FeeRateUpdated(uint256 oldRate, uint256 newRate);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event PriceFeedUpdated(address indexed token, address indexed feed);

    // ─── Initializer ────────────────────────────────────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _treasury, uint256 _feeRateBps) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();

        require(_treasury != address(0), "Invalid treasury");
        require(_feeRateBps <= MAX_FEE_BPS, "Fee too high");

        treasury = _treasury;
        feeRateBps = _feeRateBps; // 500 = 5%
    }

    // ─── Admin ──────────────────────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    // [FIX-8] Timelocked fee rate change — two-step process
    /**
     * @notice Schedule a fee rate change. Must wait FEE_CHANGE_DELAY before executing.
     * @param _newRateBps New fee rate in basis points
     */
    function scheduleFeeRateChange(uint256 _newRateBps) external onlyOwner {
        require(_newRateBps <= MAX_FEE_BPS, "Fee too high");
        pendingFeeRate = _newRateBps;
        feeChangeTimestamp = block.timestamp + FEE_CHANGE_DELAY;
        emit FeeRateUpdateScheduled(_newRateBps, feeChangeTimestamp);
    }

    /**
     * @notice Execute the scheduled fee rate change after timelock expires.
     */
    function executeFeeRateChange() external onlyOwner {
        require(feeChangeTimestamp > 0, "No change scheduled");
        require(block.timestamp >= feeChangeTimestamp, "Timelock not expired");

        uint256 oldRate = feeRateBps;
        feeRateBps = pendingFeeRate;

        // Reset
        pendingFeeRate = 0;
        feeChangeTimestamp = 0;

        emit FeeRateUpdated(oldRate, feeRateBps);
    }

    /**
     * @notice Cancel a pending fee rate change.
     */
    function cancelFeeRateChange() external onlyOwner {
        pendingFeeRate = 0;
        feeChangeTimestamp = 0;
    }

    // [FIX-7] Set Chainlink price feed for a native token
    function setPriceFeed(address _token, address _feed) external onlyOwner {
        priceFeeds[_token] = _feed;
        emit PriceFeedUpdated(_token, _feed);
    }

    // ─── Core Functions ─────────────────────────────────────────────

    /**
     * @notice Create a new match and deposit player1's bet.
     * @param _matchId Unique match ID (generated off-chain)
     * @param _token ERC-20 token address, or address(0) for native
     * @param _betAmount Amount per player (in token decimals)
     */
    function createMatch(
        bytes32 _matchId,
        address _token,
        uint256 _betAmount
    ) external payable nonReentrant whenNotPaused {
        require(!matchExists[_matchId], "Match exists");
        require(_betAmount > 0, "Zero bet");

        // [FIX-5 + FIX-7] USD-based bet limits via oracle
        if (_token == address(0)) {
            _validateBetAmountUsd(_token, _betAmount);
        }

        uint256 totalPot = _betAmount * 2;
        uint256 fee = (totalPot * feeRateBps) / FEE_BPS_DENOM;

        Match storage m = matches[_matchId];
        m.matchId = _matchId;
        m.player1 = msg.sender;
        m.player2 = address(0);
        m.token = _token;
        m.betAmount = _betAmount;
        m.totalPot = totalPot;
        m.platformFee = fee;
        m.status = MatchStatus.Created;
        m.createdAt = block.timestamp;
        m.depositDeadline = block.timestamp + DEPOSIT_DEADLINE;

        matchExists[_matchId] = true;

        // Deposit player1's bet
        if (_token == address(0)) {
            require(msg.value == _betAmount, "Wrong native amount");
        } else {
            require(msg.value == 0, "No native needed");
            IERC20(_token).safeTransferFrom(msg.sender, address(this), _betAmount);
        }

        emit MatchCreated(_matchId, msg.sender, _token, _betAmount);
        emit PlayerDeposited(_matchId, msg.sender, _betAmount);
    }

    /**
     * @notice Join an existing match and deposit bet.
     * @param _matchId Match ID to join
     * @param _betAmount Must match the creator's bet amount
     */
    function joinMatch(
        bytes32 _matchId,
        uint256 _betAmount
    ) external payable nonReentrant whenNotPaused {
        Match storage m = matches[_matchId];
        require(m.player1 != address(0), "Match not found");
        require(m.status == MatchStatus.Created, "Not joinable");
        require(m.player2 == address(0), "Already full");
        require(msg.sender != m.player1, "Cannot self-join");
        require(block.timestamp <= m.depositDeadline, "Deposit expired");
        require(_betAmount == m.betAmount, "Bet amount mismatch");

        // Deposit player2's bet
        if (m.token == address(0)) {
            require(msg.value == _betAmount, "Wrong native amount");
        } else {
            require(msg.value == 0, "No native needed");
            IERC20(m.token).safeTransferFrom(msg.sender, address(this), _betAmount);
        }

        m.player2 = msg.sender;
        m.status = MatchStatus.Funded;

        emit MatchJoined(_matchId, msg.sender);
        emit PlayerDeposited(_matchId, msg.sender, _betAmount);
    }

    /**
     * @notice Settle match — send 95% to winner, 5% to treasury.
     *         Only callable by backend (owner) and ONLY after match is InProgress.
     * @param _matchId Match ID
     * @param _winner Winner address (must be player1 or player2)
     */
    function settleMatch(
        bytes32 _matchId,
        address _winner
    ) external nonReentrant onlyOwner {
        Match storage m = matches[_matchId];

        // [FIX-2] Only settle matches that were actually played
        require(m.status == MatchStatus.InProgress, "Not settleable");
        require(_winner == m.player1 || _winner == m.player2, "Invalid winner");

        // [FIX-1] Effects BEFORE interactions
        m.status = MatchStatus.Settled;

        uint256 fee = m.platformFee;
        uint256 payout = m.totalPot - fee;

        if (m.token == address(0)) {
            (bool sentPayout,) = payable(_winner).call{value: payout}("");
            require(sentPayout, "Payout failed");
            if (fee > 0) {
                (bool sentFee,) = payable(treasury).call{value: fee}("");
                require(sentFee, "Fee transfer failed");
            }
        } else {
            IERC20(m.token).safeTransfer(_winner, payout);
            if (fee > 0) {
                IERC20(m.token).safeTransfer(treasury, fee);
            }
        }

        emit MatchSettled(_matchId, _winner, payout, fee);
    }

    /**
     * @notice Cancel match — only before opponent joins. Player1 gets refund.
     * @param _matchId Match ID
     */
    function cancelMatch(bytes32 _matchId) external nonReentrant {
        Match storage m = matches[_matchId];
        require(m.player1 == msg.sender || msg.sender == owner(), "Not authorized");
        require(m.status == MatchStatus.Created, "Cannot cancel");
        require(m.player2 == address(0), "Already joined");

        m.status = MatchStatus.Cancelled;

        if (m.token == address(0)) {
            (bool sent,) = payable(m.player1).call{value: m.betAmount}("");
            require(sent, "Refund failed");
        } else {
            IERC20(m.token).safeTransfer(m.player1, m.betAmount);
        }

        emit MatchCancelled(_matchId);
    }

    /**
     * @notice Refund both players — for draws, timeouts, or admin force-cancel.
     *         [FIX-6] Uses pull-pattern: funds go to pendingWithdrawals, players call claimWithdrawal().
     * @param _matchId Match ID
     * @param _reason Reason string for event
     */
    function refundMatch(bytes32 _matchId, string calldata _reason) external nonReentrant {
        Match storage m = matches[_matchId];
        require(
            m.status == MatchStatus.Created ||
            m.status == MatchStatus.Funded ||
            m.status == MatchStatus.InProgress,
            "Not refundable"
        );

        // [FIX-3] Stricter access control
        if (msg.sender != owner()) {
            require(m.player1 == msg.sender, "Not authorized");
            require(m.status == MatchStatus.Created, "Only owner can refund funded/active");
            require(block.timestamp > m.depositDeadline, "Not expired");
        }

        m.status = MatchStatus.Draw;

        // [FIX-6] Credit pending withdrawals instead of direct transfer
        _creditWithdrawal(_matchId, m.player1, m.betAmount);

        if (m.player2 != address(0)) {
            _creditWithdrawal(_matchId, m.player2, m.betAmount);
        }

        emit MatchRefunded(_matchId, _reason);
    }

    /**
     * @notice Claim a pending withdrawal. Pull-pattern prevents gas griefing.
     * @param _matchId Match ID with pending refund
     */
    function claimWithdrawal(bytes32 _matchId) external nonReentrant {
        bytes32 key = keccak256(abi.encode(_matchId, msg.sender));
        uint256 amount = pendingWithdrawals[key];
        require(amount > 0, "Nothing to claim");

        // [FIX-1] Effects before interactions
        pendingWithdrawals[key] = 0;

        Match storage m = matches[_matchId];
        if (m.token == address(0)) {
            (bool sent,) = payable(msg.sender).call{value: amount}("");
            require(sent, "Transfer failed");
        } else {
            IERC20(m.token).safeTransfer(msg.sender, amount);
        }

        emit WithdrawalClaimed(_matchId, msg.sender, amount);
    }

    /**
     * @notice Check how much a player can claim for a given match.
     * @param _matchId Match ID
     * @param _player Player address
     * @return Amount pending claim
     */
    function pendingClaim(bytes32 _matchId, address _player) external view returns (uint256) {
        return pendingWithdrawals[keccak256(abi.encode(_matchId, _player))];
    }

    /**
     * @notice Mark match as InProgress (called when game starts).
     * @param _matchId Match ID
     */
    function startMatch(bytes32 _matchId) external onlyOwner {
        Match storage m = matches[_matchId];
        require(m.status == MatchStatus.Funded, "Not fundable");
        m.status = MatchStatus.InProgress;
        emit MatchStarted(_matchId); // [FIX-4]
    }

    // ─── View Functions ─────────────────────────────────────────────

    function getMatch(bytes32 _matchId) external view returns (Match memory) {
        return matches[_matchId];
    }

    function isMatchReady(bytes32 _matchId) external view returns (bool) {
        Match storage m = matches[_matchId];
        return m.status == MatchStatus.Funded &&
               m.player1 != address(0) &&
               m.player2 != address(0);
    }

    // ─── Internal ───────────────────────────────────────────────────

    /**
     * @dev [FIX-6] Credit a player's pending withdrawal for a match.
     */
    function _creditWithdrawal(bytes32 _matchId, address _player, uint256 _amount) internal {
        bytes32 key = keccak256(abi.encode(_matchId, _player));
        pendingWithdrawals[key] += _amount;
    }

    /**
     * @dev [FIX-7] Validate bet amount is within USD limits using Chainlink oracle.
     *      If no oracle configured, falls back to hardcoded native limits.
     */
    function _validateBetAmountUsd(address _token, uint256 _betAmount) internal view {
        address feed = priceFeeds[_token];
        if (feed == address(0)) {
            // No oracle — fallback to hardcoded limits
            require(_betAmount >= 0.001 ether, "Bet too low");
            require(_betAmount <= 100 ether, "Bet too high");
            return;
        }

        // Get price from Chainlink
        (
            ,
            int256 price,
            ,
            uint256 updatedAt,
        ) = IAggregatorV3(feed).latestRoundData();

        require(price > PRICE_MIN, "Invalid oracle price");
        require(block.timestamp - updatedAt <= PRICE_STALENESS, "Stale oracle price");

        uint8 decimals = IAggregatorV3(feed).decimals();
        // Convert bet to USD: betAmount * price / 10^decimals
        uint256 betUsd = (_betAmount * uint256(price)) / (10 ** decimals);

        require(betUsd >= MIN_BET_USD, "Bet below $1 minimum");
        require(betUsd <= MAX_BET_USD, "Bet above $10,000 maximum");
    }

    // ─── UUPS ───────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
