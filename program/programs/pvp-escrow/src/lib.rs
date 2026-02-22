use anchor_lang::prelude::*;

declare_id!("EcYHHLz81H1oAZxY5uoU3VoxvwftKDFQxHzkZfqUmy2p");

#[program]
pub mod pvp_escrow {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
