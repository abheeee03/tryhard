use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("AystLWreZ41EQzWgkTXTRYGn83qiQoxZqiLaBAdn4iFA");

#[program]
pub mod pvp_escrow {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        game_id: String,
        bet_amount: u64,
        backend_auth: Pubkey,
    ) -> Result<()> {
        require!(game_id.len() <= 32, ErrorCode::GameIdTooLong);

        let escrow = &mut ctx.accounts.escrow;
        escrow.player1 = ctx.accounts.player1.key();
        escrow.player2 = Pubkey::default();
        escrow.bet_amount = bet_amount;
        escrow.game_id = game_id;
        escrow.backend_auth = backend_auth;
        escrow.is_joined = false;
        escrow.bump = ctx.bumps.escrow;

        // Transfer bet_amount from player1 to escrow PDA
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.player1.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                },
            ),
            bet_amount,
        )?;

        Ok(())
    }

    pub fn join(ctx: Context<Join>, _game_id: String) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(!escrow.is_joined, ErrorCode::GameAlreadyJoined);
        
        escrow.player2 = ctx.accounts.player2.key();
        escrow.is_joined = true;
        let bet_amount = escrow.bet_amount;

        // Transfer bet_amount from player2 to escrow PDA
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.player2.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                },
            ),
            bet_amount,
        )?;

        msg!("Player 2 joined! Game started!");

        Ok(())
    }

    pub fn resolve(ctx: Context<Resolve>, _game_id: String) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        
        require!(escrow.is_joined, ErrorCode::GameNotJoined);
        require!(
            ctx.accounts.winner.key() == escrow.player1 || ctx.accounts.winner.key() == escrow.player2,
            ErrorCode::InvalidWinner
        );

        // close = winner
        msg!("Game resolved! Winner paid!");
        Ok(())
    }

    pub fn cancel(ctx: Context<Cancel>, _game_id: String) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        
        require!(!escrow.is_joined, ErrorCode::GameAlreadyJoined);
        
        // close = player1
        msg!("Game cancelled! Player 1 refunded.");
        Ok(())
    }

    pub fn draw(ctx: Context<Draw>, _game_id: String) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        require!(escrow.is_joined, ErrorCode::GameNotJoined);
        require_keys_eq!(ctx.accounts.player1.key(), escrow.player1,    ErrorCode::InvalidPlayer1);
        require_keys_eq!(ctx.accounts.player2.key(), escrow.player2, ErrorCode::InvalidPlayer2);

        let amount = escrow.bet_amount;
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.player2.to_account_info().try_borrow_mut_lamports()? += amount;

        // close = player1
        msg!("Game drawn! Players refunded.");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub player1: Signer<'info>,

    #[account(
        init,
        payer = player1,
        // 8 (anchor discriminator) +
        // 32 (player1) + 32 (player2) +
        // 8 (bet_amount u64) +
        // 4 + 32 (game_id string up to 32 chars) +
        // 32 (backend_auth) +
        // 1 (is_joined bool) + 
        // 1 (bump u8) 
        // = 150 bytes total Space
        space = 150,
        seeds = [b"escrow", game_id.as_bytes()],
        bump
    )]
    pub escrow: Account<'info, GameEscrow>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct Join<'info> {
    #[account(mut)]
    pub player2: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", game_id.as_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, GameEscrow>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct Resolve<'info> {
    // The backend authority acts as a co-signer to approve the payout and declare the winner.
    pub backend_auth: Signer<'info>,

    /// CHECK: account is either player 1 or player 2
    #[account(mut)]
    pub winner: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"escrow", game_id.as_bytes()],
        bump = escrow.bump,
        has_one = backend_auth,
        close = winner
    )]
    pub escrow: Account<'info, GameEscrow>,
}

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct Cancel<'info> {
    #[account(mut)]
    pub player1: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", game_id.as_bytes()],
        bump = escrow.bump,
        has_one = player1,
        close = player1
    )]
    pub escrow: Account<'info, GameEscrow>,
}

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct Draw<'info> {
    pub backend_auth: Signer<'info>,

    /// CHECK: validated manually in the instruction body
    #[account(mut)]
    pub player1: AccountInfo<'info>,

    /// CHECK: validated manually in the instruction body
    #[account(mut)]
    pub player2: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"escrow", game_id.as_bytes()],
        bump = escrow.bump,
        has_one = backend_auth,
        close = player1
    )]
    pub escrow: Account<'info, GameEscrow>,
}

#[account]
pub struct GameEscrow {
    pub player1: Pubkey,
    pub player2: Pubkey,
    pub bet_amount: u64,
    pub game_id: String,
    pub backend_auth: Pubkey,
    pub is_joined: bool,
    pub bump: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Game ID cannot be longer than 32 characters.")]
    GameIdTooLong,
    #[msg("Game has already been joined by another player.")]
    GameAlreadyJoined,
    #[msg("Game has not been joined by a second player yet.")]
    GameNotJoined,
    #[msg("The provided winner is neither player 1 nor player 2.")]
    InvalidWinner,
    #[msg("Invalid player 1 account.")]
    InvalidPlayer1,
    #[msg("Invalid player 2 account.")]
    InvalidPlayer2,
}
