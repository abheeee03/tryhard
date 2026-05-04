use anchor_lang::prelude::*;

declare_id!("5GhNUDBKQQbir2pPksYd3Uj9ch5wMPis7aMG5MH4Bu4v");

#[program]
pub mod tryhard_escrow {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
