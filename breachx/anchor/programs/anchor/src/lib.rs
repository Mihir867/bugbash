use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
        Metadata,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

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
        vulnerability_report.repository_id = repository_id.clone();
        vulnerability_report.report_url = report_url;
        vulnerability_report.reporter = ctx.accounts.reporter.key();
        vulnerability_report.timestamp = Clock::get()?.unix_timestamp;
        vulnerability_report.nft_mint = Pubkey::default(); // Will be set when NFT is minted

        msg!("Vulnerability report stored for repository: {}", repository_id);
        Ok(())
    }

    pub fn mint_security_badge_nft(
        ctx: Context<MintSecurityBadgeNft>,
        repository_id: String,
        metadata_title: String,
        metadata_symbol: String,
        metadata_uri: String,
    ) -> Result<()> {
        let vulnerability_report = &mut ctx.accounts.vulnerability_report;
        vulnerability_report.nft_mint = ctx.accounts.mint.key();

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.reporter.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        mint_to(cpi_ctx, 1)?;

        let data_v2 = DataV2 {
            name: metadata_title,
            symbol: metadata_symbol,
            uri: metadata_uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        let metadata_ctx = CpiContext::new(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                payer: ctx.accounts.reporter.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                metadata: ctx.accounts.metadata.to_account_info(),
                mint_authority: ctx.accounts.reporter.to_account_info(),
                update_authority: ctx.accounts.reporter.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
        );

        create_metadata_accounts_v3(
            metadata_ctx,
            data_v2,
            true,
            true,
            None,
        )?;

        msg!("Security badge NFT minted successfully for repository: {}", repository_id);
        Ok(())
    }

    // Keep the combined function for backward compatibility
    pub fn store_vulnerability_report_and_mint_nft(
        ctx: Context<StoreVulnerabilityReportAndMintNft>,
        repository_id: String,
        report_url: String,
        metadata_title: String,
        metadata_symbol: String,
        metadata_uri: String,
    ) -> Result<()> {
        let vulnerability_report = &mut ctx.accounts.vulnerability_report;
        vulnerability_report.repository_id = repository_id.clone();
        vulnerability_report.report_url = report_url;
        vulnerability_report.reporter = ctx.accounts.reporter.key();
        vulnerability_report.timestamp = Clock::get()?.unix_timestamp;
        vulnerability_report.nft_mint = ctx.accounts.mint.key();

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.reporter.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        mint_to(cpi_ctx, 1)?;

        let data_v2 = DataV2 {
            name: metadata_title,
            symbol: metadata_symbol,
            uri: metadata_uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        let metadata_ctx = CpiContext::new(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                payer: ctx.accounts.reporter.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                metadata: ctx.accounts.metadata.to_account_info(),
                mint_authority: ctx.accounts.reporter.to_account_info(),
                update_authority: ctx.accounts.reporter.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
        );

        create_metadata_accounts_v3(
            metadata_ctx,
            data_v2,
            true,
            true,
            None,
        )?;

        msg!("NFT minted successfully for repository: {}", repository_id);
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
        8 + // timestamp
        32, // nft_mint pubkey
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

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(repository_id: String)]
pub struct MintSecurityBadgeNft<'info> {
    #[account(
        mut,
        seeds = [
            b"vulnerability_report",
            reporter.key().as_ref(),
            repository_id.as_bytes()
        ],
        bump
    )]
    pub vulnerability_report: Account<'info, VulnerabilityReport>,

    #[account(
        init,
        payer = reporter,
        mint::decimals = 0,
        mint::authority = reporter,
        mint::freeze_authority = reporter,
        seeds = [
            b"mint",
            reporter.key().as_ref(),
            repository_id.as_bytes()
        ],
        bump
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = reporter,
        associated_token::mint = mint,
        associated_token::authority = reporter
    )]
    pub token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    #[account(mut)]
    pub reporter: Signer<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
}

#[derive(Accounts)]
#[instruction(repository_id: String)]
pub struct StoreVulnerabilityReportAndMintNft<'info> {
    #[account(
        init,
        payer = reporter,
        space = 8 + // discriminator
        4 + 50 + // repository_id (String with max 50 chars)
        4 + 200 + // report_url (String with max 200 chars)
        32 + // reporter pubkey
        8 + // timestamp
        32, // nft_mint pubkey
        seeds = [
            b"vulnerability_report",
            reporter.key().as_ref(),
            repository_id.as_bytes()
        ],
        bump
    )]
    pub vulnerability_report: Account<'info, VulnerabilityReport>,

    #[account(
        init,
        payer = reporter,
        mint::decimals = 0,
        mint::authority = reporter,
        mint::freeze_authority = reporter,
        seeds = [
            b"mint",
            reporter.key().as_ref(),
            repository_id.as_bytes()
        ],
        bump
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = reporter,
        associated_token::mint = mint,
        associated_token::authority = reporter
    )]
    pub token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    #[account(mut)]
    pub reporter: Signer<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
}

#[account]
pub struct VulnerabilityReport {
    pub repository_id: String,
    pub report_url: String,
    pub reporter: Pubkey,
    pub timestamp: i64,
    pub nft_mint: Pubkey,
}