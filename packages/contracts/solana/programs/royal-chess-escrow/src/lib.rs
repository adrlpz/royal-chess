use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("47oFrH5ePiNvnXCpKy7jR7ghcqC747RLw6QLsr9bkMx4");

// ─── Constants ──────────────────────────────────────────────────────
const FEE_BPS_DENOM: u64 = 10_000;
const MAX_FEE_BPS: u64 = 1_000; // 10%
const DEPOSIT_DEADLINE_SECS: i64 = 300; // 5 minutes

// ─── Program ────────────────────────────────────────────────────────
#[program]
pub mod royal_chess_escrow {
    use super::*;

    /// Initialize the global escrow state (once per program deploy).
    pub fn initialize(ctx: Context<Initialize>, fee_rate_bps: u64) -> Result<()> {
        require!(fee_rate_bps <= MAX_FEE_BPS, EscrowError::FeeTooHigh);

        let state = &mut ctx.accounts.state;
        state.authority = ctx.accounts.authority.key();
        state.treasury = ctx.accounts.treasury.key();
        state.fee_rate_bps = fee_rate_bps;
        state.paused = false;
        state.match_counter = 0;
        state.bump = ctx.bumps.state;

        msg!("Royal Chess Escrow initialized. Fee: {} bps", fee_rate_bps);
        Ok(())
    }

    /// Create a new match with native SOL deposit.
    pub fn create_match_sol(
        ctx: Context<CreateMatchSol>,
        match_id: [u8; 32],
        bet_amount: u64,
    ) -> Result<()> {
        let state = &ctx.accounts.state;
        require!(!state.paused, EscrowError::Paused);
        require!(bet_amount > 0, EscrowError::ZeroBet);

        let clock = Clock::get()?;
        let total_pot = bet_amount.checked_mul(2).ok_or(EscrowError::Overflow)?;
        let fee = total_pot
            .checked_mul(state.fee_rate_bps)
            .ok_or(EscrowError::Overflow)?
            .checked_div(FEE_BPS_DENOM)
            .ok_or(EscrowError::Overflow)?;

        // Transfer SOL from player1 to escrow PDA
        let ix = solana_program::system_instruction::transfer(
            &ctx.accounts.player1.key(),
            &ctx.accounts.escrow_vault.key(),
            bet_amount,
        );
        solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.player1.to_account_info(),
                ctx.accounts.escrow_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let m = &mut ctx.accounts.match_account;
        m.match_id = match_id;
        m.player_1 = ctx.accounts.player1.key();
        m.player_2 = Pubkey::default();
        m.is_spl = false;
        m.bet_mint = Pubkey::default();
        m.bet_amount = bet_amount;
        m.total_pot = total_pot;
        m.platform_fee = fee;
        m.status = MatchStatus::Created;
        m.created_at = clock.unix_timestamp;
        m.deposit_deadline = clock.unix_timestamp + DEPOSIT_DEADLINE_SECS;
        m.escrow_bump = ctx.bumps.escrow_vault;
        m.bump = ctx.bumps.match_account;

        emit!(MatchCreated {
            match_id,
            player_1: ctx.accounts.player1.key(),
            bet_amount,
            is_spl: false,
        });

        Ok(())
    }

    /// Create a new match with SPL token deposit.
    pub fn create_match_spl(
        ctx: Context<CreateMatchSpl>,
        match_id: [u8; 32],
        bet_amount: u64,
    ) -> Result<()> {
        let state = &ctx.accounts.state;
        require!(!state.paused, EscrowError::Paused);
        require!(bet_amount > 0, EscrowError::ZeroBet);

        let clock = Clock::get()?;
        let total_pot = bet_amount.checked_mul(2).ok_or(EscrowError::Overflow)?;
        let fee = total_pot
            .checked_mul(state.fee_rate_bps)
            .ok_or(EscrowError::Overflow)?
            .checked_div(FEE_BPS_DENOM)
            .ok_or(EscrowError::Overflow)?;

        // Transfer SPL tokens from player1 to escrow vault ATA
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player1_ata.to_account_info(),
                    to: ctx.accounts.escrow_vault_ata.to_account_info(),
                    authority: ctx.accounts.player1.to_account_info(),
                },
            ),
            bet_amount,
        )?;

        let m = &mut ctx.accounts.match_account;
        m.match_id = match_id;
        m.player_1 = ctx.accounts.player1.key();
        m.player_2 = Pubkey::default();
        m.is_spl = true;
        m.bet_mint = ctx.accounts.bet_mint.key();
        m.bet_amount = bet_amount;
        m.total_pot = total_pot;
        m.platform_fee = fee;
        m.status = MatchStatus::Created;
        m.created_at = clock.unix_timestamp;
        m.deposit_deadline = clock.unix_timestamp + DEPOSIT_DEADLINE_SECS;
        m.escrow_bump = ctx.bumps.escrow_vault;
        m.bump = ctx.bumps.match_account;

        emit!(MatchCreated {
            match_id,
            player_1: ctx.accounts.player1.key(),
            bet_amount,
            is_spl: true,
        });

        Ok(())
    }

    /// Join an existing match with native SOL.
    pub fn join_match_sol(ctx: Context<JoinMatchSol>, bet_amount: u64) -> Result<()> {
        let clock = Clock::get()?;
        let m = &mut ctx.accounts.match_account;

        require!(m.status == MatchStatus::Created, EscrowError::NotJoinable);
        require!(m.player_2 == Pubkey::default(), EscrowError::AlreadyFull);
        require!(ctx.accounts.player2.key() != m.player_1, EscrowError::SelfJoin);
        require!(clock.unix_timestamp <= m.deposit_deadline, EscrowError::DepositExpired);
        require!(bet_amount == m.bet_amount, EscrowError::BetMismatch);

        // Transfer SOL from player2 to escrow
        let ix = solana_program::system_instruction::transfer(
            &ctx.accounts.player2.key(),
            &ctx.accounts.escrow_vault.key(),
            bet_amount,
        );
        solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.player2.to_account_info(),
                ctx.accounts.escrow_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        m.player_2 = ctx.accounts.player2.key();
        m.status = MatchStatus::Funded;

        emit!(MatchJoined {
            match_id: m.match_id,
            player_2: ctx.accounts.player2.key(),
        });

        Ok(())
    }

    /// Join an existing match with SPL token.
    pub fn join_match_spl(ctx: Context<JoinMatchSpl>, bet_amount: u64) -> Result<()> {
        let clock = Clock::get()?;
        let m = &mut ctx.accounts.match_account;

        require!(m.status == MatchStatus::Created, EscrowError::NotJoinable);
        require!(m.player_2 == Pubkey::default(), EscrowError::AlreadyFull);
        require!(ctx.accounts.player2.key() != m.player_1, EscrowError::SelfJoin);
        require!(clock.unix_timestamp <= m.deposit_deadline, EscrowError::DepositExpired);
        require!(bet_amount == m.bet_amount, EscrowError::BetMismatch);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player2_ata.to_account_info(),
                    to: ctx.accounts.escrow_vault_ata.to_account_info(),
                    authority: ctx.accounts.player2.to_account_info(),
                },
            ),
            bet_amount,
        )?;

        m.player_2 = ctx.accounts.player2.key();
        m.status = MatchStatus::Funded;

        emit!(MatchJoined {
            match_id: m.match_id,
            player_2: ctx.accounts.player2.key(),
        });

        Ok(())
    }

    /// Settle match — only authority (backend) can call.
    /// Sends 95% to winner, 5% to treasury.
    pub fn settle_match(ctx: Context<SettleMatch>, winner: Pubkey) -> Result<()> {
        let m = &mut ctx.accounts.match_account;
        require!(
            m.status == MatchStatus::Funded || m.status == MatchStatus::InProgress,
            EscrowError::NotSettleable
        );
        require!(
            winner == m.player_1 || winner == m.player_2,
            EscrowError::InvalidWinner
        );

        let payout = m
            .total_pot
            .checked_sub(m.platform_fee)
            .ok_or(EscrowError::Overflow)?;
        let fee = m.platform_fee;

        if m.is_spl {
            // SPL token settlement — must have all SPL accounts
            let escrow_vault_ata = ctx
                .accounts
                .escrow_vault_ata
                .as_ref()
                .ok_or(EscrowError::MissingSplAccount)?;
            let winner_ata = ctx
                .accounts
                .winner_ata
                .as_ref()
                .ok_or(EscrowError::MissingSplAccount)?;
            let treasury_ata = ctx
                .accounts
                .treasury_ata
                .as_ref()
                .ok_or(EscrowError::MissingSplAccount)?;

            let seeds: &[&[u8]] = &[
                b"escrow".as_ref(),
                m.match_id.as_ref(),
                &[m.escrow_bump],
            ];
            let signer_seeds = &[seeds];

            // Pay winner
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: escrow_vault_ata.to_account_info(),
                        to: winner_ata.to_account_info(),
                        authority: ctx.accounts.escrow_vault.to_account_info(),
                    },
                    signer_seeds,
                ),
                payout,
            )?;

            // Pay treasury
            if fee > 0 {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: escrow_vault_ata.to_account_info(),
                            to: treasury_ata.to_account_info(),
                            authority: ctx.accounts.escrow_vault.to_account_info(),
                        },
                        signer_seeds,
                    ),
                    fee,
                )?;
            }
        } else {
            // Native SOL settlement — direct lamport manipulation
            **ctx
                .accounts
                .escrow_vault
                .try_borrow_mut_lamports()? -= payout;
            **ctx.accounts.winner.try_borrow_mut_lamports()? += payout;

            if fee > 0 {
                **ctx
                    .accounts
                    .escrow_vault
                    .try_borrow_mut_lamports()? -= fee;
                **ctx.accounts.treasury.try_borrow_mut_lamports()? += fee;
            }
        }

        m.status = MatchStatus::Settled;

        emit!(MatchSettled {
            match_id: m.match_id,
            winner,
            payout,
            fee,
        });

        Ok(())
    }

    /// Cancel match — player1 only, before opponent joins. Full refund.
    pub fn cancel_match(ctx: Context<CancelMatch>) -> Result<()> {
        let m = &mut ctx.accounts.match_account;
        require!(
            ctx.accounts.caller.key() == m.player_1
                || ctx.accounts.caller.key() == ctx.accounts.state.authority,
            EscrowError::NotAuthorized
        );
        require!(m.status == MatchStatus::Created, EscrowError::CannotCancel);
        require!(m.player_2 == Pubkey::default(), EscrowError::AlreadyJoined);

        if m.is_spl {
            let escrow_vault_ata = ctx
                .accounts
                .escrow_vault_ata
                .as_ref()
                .ok_or(EscrowError::MissingSplAccount)?;
            let player_ata = ctx
                .accounts
                .player_ata
                .as_ref()
                .ok_or(EscrowError::MissingSplAccount)?;

            let seeds: &[&[u8]] = &[
                b"escrow".as_ref(),
                m.match_id.as_ref(),
                &[m.escrow_bump],
            ];
            let signer_seeds = &[seeds];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: escrow_vault_ata.to_account_info(),
                        to: player_ata.to_account_info(),
                        authority: ctx.accounts.escrow_vault.to_account_info(),
                    },
                    signer_seeds,
                ),
                m.bet_amount,
            )?;
        } else {
            **ctx
                .accounts
                .escrow_vault
                .try_borrow_mut_lamports()? -= m.bet_amount;
            **ctx.accounts.caller.try_borrow_mut_lamports()? += m.bet_amount;
        }

        m.status = MatchStatus::Cancelled;

        emit!(MatchCancelled {
            match_id: m.match_id,
        });

        Ok(())
    }

    /// Refund both players — for draws, timeouts, or admin force-cancel.
    pub fn refund_match(ctx: Context<RefundMatch>, reason: String) -> Result<()> {
        let m = &mut ctx.accounts.match_account;
        require!(
            m.status == MatchStatus::Created
                || m.status == MatchStatus::Funded
                || m.status == MatchStatus::InProgress,
            EscrowError::NotRefundable
        );

        let is_authority = ctx.accounts.caller.key() == ctx.accounts.state.authority;
        let is_expired_player1 =
            ctx.accounts.caller.key() == m.player_1 && m.status == MatchStatus::Created;

        require!(is_authority || is_expired_player1, EscrowError::NotAuthorized);

        if m.is_spl {
            let escrow_vault_ata = ctx
                .accounts
                .escrow_vault_ata
                .as_ref()
                .ok_or(EscrowError::MissingSplAccount)?;

            let seeds: &[&[u8]] = &[
                b"escrow".as_ref(),
                m.match_id.as_ref(),
                &[m.escrow_bump],
            ];
            let signer_seeds = &[seeds];

            // Refund player 1
            let player1_ata = ctx
                .accounts
                .player1_ata
                .as_ref()
                .ok_or(EscrowError::MissingSplAccount)?;
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: escrow_vault_ata.to_account_info(),
                        to: player1_ata.to_account_info(),
                        authority: ctx.accounts.escrow_vault.to_account_info(),
                    },
                    signer_seeds,
                ),
                m.bet_amount,
            )?;

            // Refund player 2 if deposited
            if m.player_2 != Pubkey::default() {
                let player2_ata = ctx
                    .accounts
                    .player2_ata
                    .as_ref()
                    .ok_or(EscrowError::MissingSplAccount)?;
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: escrow_vault_ata.to_account_info(),
                            to: player2_ata.to_account_info(),
                            authority: ctx.accounts.escrow_vault.to_account_info(),
                        },
                        signer_seeds,
                    ),
                    m.bet_amount,
                )?;
            }
        } else {
            // SOL refund — direct lamport manipulation
            **ctx
                .accounts
                .escrow_vault
                .try_borrow_mut_lamports()? -= m.bet_amount;
            **ctx.accounts.player1.try_borrow_mut_lamports()? += m.bet_amount;

            if m.player_2 != Pubkey::default() {
                **ctx
                    .accounts
                    .escrow_vault
                    .try_borrow_mut_lamports()? -= m.bet_amount;
                **ctx.accounts.player2.try_borrow_mut_lamports()? += m.bet_amount;
            }
        }

        m.status = MatchStatus::Draw;

        emit!(MatchRefunded {
            match_id: m.match_id,
            reason,
        });

        Ok(())
    }

    /// Mark match as InProgress (authority/backend only).
    pub fn start_match(ctx: Context<AuthorityAction>) -> Result<()> {
        let m = &mut ctx.accounts.match_account;
        require!(m.status == MatchStatus::Funded, EscrowError::NotStartable);
        m.status = MatchStatus::InProgress;
        Ok(())
    }

    /// Update global fee rate (authority only).
    pub fn update_fee_rate(ctx: Context<AuthorityAction>, new_rate_bps: u64) -> Result<()> {
        require!(new_rate_bps <= MAX_FEE_BPS, EscrowError::FeeTooHigh);
        let state = &mut ctx.accounts.state;
        state.fee_rate_bps = new_rate_bps;
        Ok(())
    }

    /// Toggle pause (authority only).
    pub fn toggle_pause(ctx: Context<AuthorityAction>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.paused = !state.paused;
        Ok(())
    }
}

// ─── Account Structs ────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + EscrowState::INIT_SPACE,
        seeds = [b"state"],
        bump,
    )]
    pub state: Account<'info, EscrowState>,

    /// CHECK: Treasury wallet — any valid pubkey
    pub treasury: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct CreateMatchSol<'info> {
    #[account(
        init,
        payer = player1,
        space = 8 + MatchAccount::INIT_SPACE,
        seeds = [b"match", match_id.as_ref()],
        bump,
    )]
    pub match_account: Account<'info, MatchAccount>,

    /// CHECK: PDA vault holding SOL
    #[account(
        mut,
        seeds = [b"escrow", match_id.as_ref()],
        bump,
    )]
    pub escrow_vault: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"state"],
        bump = state.bump,
    )]
    pub state: Account<'info, EscrowState>,

    #[account(mut)]
    pub player1: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct CreateMatchSpl<'info> {
    #[account(
        init,
        payer = player1,
        space = 8 + MatchAccount::INIT_SPACE,
        seeds = [b"match", match_id.as_ref()],
        bump,
    )]
    pub match_account: Account<'info, MatchAccount>,

    /// CHECK: PDA vault
    #[account(
        seeds = [b"escrow", match_id.as_ref()],
        bump,
    )]
    pub escrow_vault: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"state"],
        bump = state.bump,
    )]
    pub state: Account<'info, EscrowState>,

    #[account(
        mut,
        token::mint = bet_mint,
        token::authority = player1,
    )]
    pub player1_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = player1,
        associated_token::mint = bet_mint,
        associated_token::authority = escrow_vault,
    )]
    pub escrow_vault_ata: Box<Account<'info, TokenAccount>>,

    pub bet_mint: Box<Account<'info, anchor_spl::token::Mint>>,

    #[account(mut)]
    pub player1: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct JoinMatchSol<'info> {
    #[account(
        mut,
        seeds = [b"match", match_account.match_id.as_ref()],
        bump = match_account.bump,
    )]
    pub match_account: Account<'info, MatchAccount>,

    /// CHECK: PDA vault
    #[account(
        mut,
        seeds = [b"escrow", match_account.match_id.as_ref()],
        bump = match_account.escrow_bump,
    )]
    pub escrow_vault: AccountInfo<'info>,

    #[account(mut)]
    pub player2: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinMatchSpl<'info> {
    #[account(
        mut,
        seeds = [b"match", match_account.match_id.as_ref()],
        bump = match_account.bump,
    )]
    pub match_account: Account<'info, MatchAccount>,

    /// CHECK: PDA vault
    #[account(
        seeds = [b"escrow", match_account.match_id.as_ref()],
        bump = match_account.escrow_bump,
    )]
    pub escrow_vault: AccountInfo<'info>,

    #[account(
        mut,
        token::mint = match_account.bet_mint,
        token::authority = player2,
    )]
    pub player2_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = match_account.bet_mint,
        token::authority = escrow_vault,
    )]
    pub escrow_vault_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub player2: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleMatch<'info> {
    #[account(
        mut,
        seeds = [b"match", match_account.match_id.as_ref()],
        bump = match_account.bump,
    )]
    pub match_account: Account<'info, MatchAccount>,

    #[account(
        seeds = [b"state"],
        bump = state.bump,
        constraint = state.authority == authority.key() @ EscrowError::NotAuthorized
    )]
    pub state: Account<'info, EscrowState>,

    pub authority: Signer<'info>,

    /// CHECK: PDA vault
    #[account(
        mut,
        seeds = [b"escrow", match_account.match_id.as_ref()],
        bump = match_account.escrow_bump,
    )]
    pub escrow_vault: AccountInfo<'info>,

    /// CHECK: Winner wallet
    #[account(mut)]
    pub winner: AccountInfo<'info>,

    /// CHECK: Treasury wallet
    #[account(mut, address = state.treasury @ EscrowError::InvalidTreasury)]
    pub treasury: AccountInfo<'info>,

    // SPL accounts (optional — None for native SOL settlement)
    pub escrow_vault_ata: Option<Box<Account<'info, TokenAccount>>>,
    pub winner_ata: Option<Box<Account<'info, TokenAccount>>>,
    pub treasury_ata: Option<Box<Account<'info, TokenAccount>>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelMatch<'info> {
    #[account(
        mut,
        seeds = [b"match", match_account.match_id.as_ref()],
        bump = match_account.bump,
    )]
    pub match_account: Account<'info, MatchAccount>,

    /// CHECK: PDA vault
    #[account(
        mut,
        seeds = [b"escrow", match_account.match_id.as_ref()],
        bump = match_account.escrow_bump,
    )]
    pub escrow_vault: AccountInfo<'info>,

    /// CHECK: Caller (player1 or authority)
    #[account(mut)]
    pub caller: AccountInfo<'info>,

    #[account(
        seeds = [b"state"],
        bump = state.bump,
    )]
    pub state: Account<'info, EscrowState>,

    // SPL accounts (optional)
    pub escrow_vault_ata: Option<Box<Account<'info, TokenAccount>>>,
    pub player_ata: Option<Box<Account<'info, TokenAccount>>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundMatch<'info> {
    #[account(
        mut,
        seeds = [b"match", match_account.match_id.as_ref()],
        bump = match_account.bump,
    )]
    pub match_account: Account<'info, MatchAccount>,

    /// CHECK: PDA vault
    #[account(
        mut,
        seeds = [b"escrow", match_account.match_id.as_ref()],
        bump = match_account.escrow_bump,
    )]
    pub escrow_vault: AccountInfo<'info>,

    /// CHECK: Caller
    #[account(mut)]
    pub caller: AccountInfo<'info>,

    /// CHECK: Player 1
    #[account(mut)]
    pub player1: AccountInfo<'info>,

    /// CHECK: Player 2
    #[account(mut)]
    pub player2: AccountInfo<'info>,

    #[account(
        seeds = [b"state"],
        bump = state.bump,
    )]
    pub state: Account<'info, EscrowState>,

    // SPL accounts (optional)
    pub escrow_vault_ata: Option<Box<Account<'info, TokenAccount>>>,
    pub player1_ata: Option<Box<Account<'info, TokenAccount>>>,
    pub player2_ata: Option<Box<Account<'info, TokenAccount>>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AuthorityAction<'info> {
    #[account(
        seeds = [b"state"],
        bump = state.bump,
        constraint = state.authority == authority.key() @ EscrowError::NotAuthorized
    )]
    pub state: Account<'info, EscrowState>,

    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"match", match_account.match_id.as_ref()],
        bump = match_account.bump,
    )]
    pub match_account: Account<'info, MatchAccount>,
}

// ─── State Accounts ─────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct EscrowState {
    pub authority: Pubkey,   // 32
    pub treasury: Pubkey,    // 32
    pub fee_rate_bps: u64,   // 8
    pub paused: bool,        // 1
    pub match_counter: u64,  // 8
    pub bump: u8,            // 1
}

#[account]
#[derive(InitSpace)]
pub struct MatchAccount {
    pub match_id: [u8; 32],     // 32
    pub player_1: Pubkey,       // 32
    pub player_2: Pubkey,       // 32
    pub is_spl: bool,           // 1
    pub bet_mint: Pubkey,       // 32
    pub bet_amount: u64,        // 8
    pub total_pot: u64,         // 8
    pub platform_fee: u64,      // 8
    pub status: MatchStatus,    // 1
    pub created_at: i64,        // 8
    pub deposit_deadline: i64,  // 8
    pub escrow_bump: u8,        // 1
    pub bump: u8,               // 1
}

// ─── Enums ──────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum MatchStatus {
    Created,
    Funded,
    InProgress,
    Settled,
    Cancelled,
    Draw,
}

// ─── Events ─────────────────────────────────────────────────────────

#[event]
pub struct MatchCreated {
    pub match_id: [u8; 32],
    pub player_1: Pubkey,
    pub bet_amount: u64,
    pub is_spl: bool,
}

#[event]
pub struct MatchJoined {
    pub match_id: [u8; 32],
    pub player_2: Pubkey,
}

#[event]
pub struct MatchSettled {
    pub match_id: [u8; 32],
    pub winner: Pubkey,
    pub payout: u64,
    pub fee: u64,
}

#[event]
pub struct MatchCancelled {
    pub match_id: [u8; 32],
}

#[event]
pub struct MatchRefunded {
    pub match_id: [u8; 32],
    pub reason: String,
}

// ─── Errors ─────────────────────────────────────────────────────────

#[error_code]
pub enum EscrowError {
    #[msg("Fee rate exceeds maximum (10%)")]
    FeeTooHigh,
    #[msg("Program is paused")]
    Paused,
    #[msg("Bet amount must be greater than zero")]
    ZeroBet,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Match is not joinable")]
    NotJoinable,
    #[msg("Match already has two players")]
    AlreadyFull,
    #[msg("Cannot join your own match")]
    SelfJoin,
    #[msg("Deposit deadline expired")]
    DepositExpired,
    #[msg("Bet amount mismatch")]
    BetMismatch,
    #[msg("Match is not settleable")]
    NotSettleable,
    #[msg("Invalid winner address")]
    InvalidWinner,
    #[msg("Not authorized")]
    NotAuthorized,
    #[msg("Cannot cancel — opponent already joined")]
    AlreadyJoined,
    #[msg("Match cannot be cancelled in current state")]
    CannotCancel,
    #[msg("Match is not refundable")]
    NotRefundable,
    #[msg("Invalid treasury address")]
    InvalidTreasury,
    #[msg("Match cannot be started")]
    NotStartable,
    #[msg("Missing SPL token account")]
    MissingSplAccount,
}
