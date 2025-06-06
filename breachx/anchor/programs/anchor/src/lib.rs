use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;

declare_id!("gK7LKdzB7mKMHGg7Tio7Yatjhrb6V3yAGkYTqbTSoKz");

#[program]
pub mod anchor {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn store_vulnerability_report(
        ctx: Context<StoreVulnerabilityReport>,
        repository_id: String,
        report_url: String,
    ) -> Result<()> {
        let vulnerability_report = &mut ctx.accounts.vulnerability_report;
        vulnerability_report.repository_id = repository_id;
        vulnerability_report.report_url = report_url;
        vulnerability_report.reporter = ctx.accounts.reporter.key();
        vulnerability_report.timestamp = Clock::get()?.unix_timestamp;
        
        Ok(())
    }
}

pub trait StringExt {
    fn to_hashed_bytes(&self) -> [u8; 32];
}

impl StringExt for String {
    fn to_hashed_bytes(&self) -> [u8; 32] {
        let hash = hash(self.as_bytes());
        hash.to_bytes()
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
#[instruction(repository_id: String)]
pub struct StoreVulnerabilityReport<'info> {
    #[account(
        init,
        payer = reporter,
        space = 8 + // discriminator
               4 + 200 + // repository_id (String with max 200 chars)
               4 + 1000 + // report_url (String with max 1000 chars)
               32 + // reporter pubkey
               8, // timestamp
        seeds = [
            b"vulnerability_report",
            reporter.key().as_ref(),
            &repository_id.to_hashed_bytes()
        ],
        bump
    )]
    pub vulnerability_report: Account<'info, VulnerabilityReport>,
    
    #[account(mut)]
    pub reporter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct VulnerabilityReport {
    pub repository_id: String,
    pub report_url: String,
    pub reporter: Pubkey,
    pub timestamp: i64,
}