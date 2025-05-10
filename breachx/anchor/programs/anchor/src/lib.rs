use anchor_lang::prelude::*;

declare_id!("CT2TbWY3ny6wn6jRq3RPdqh4gnmtupzNhdJHeWCkzaKw");

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

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
#[instruction(repository_id: String)]
pub struct StoreVulnerabilityReport<'info> {
    #[account(
        init,
        payer = reporter,
        space = 8 + // discriminator
               4 + 50 + // repository_id (String with max 50 chars)
               4 + 200 + // report_url (String with max 200 chars)
               32 + // reporter pubkey
               8, // timestamp
        seeds = [
            b"vulnerability_report", 
            reporter.key().as_ref(),
            repository_id.as_bytes()
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