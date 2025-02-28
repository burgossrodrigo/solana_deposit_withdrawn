use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::program::invoke;

declare_id!("6GJBeuJUCxsYnwiWpyzqyAaSTz5UrxmWVck1HBDUPaYd");

#[program]
pub mod solana_deposit_withdrawn {
    use super::*;

    // Initialize the vault account
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.owner = *ctx.accounts.authority.key;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let from = &ctx.accounts.from;
        let to = &ctx.accounts.vault;

        // Ensure the `from` account has enough SOL to deposit
        if from.lamports() < amount {
            return Err(ProgramError::InsufficientFunds.into());
        }

        // Transfer SOL from `from` to `vault`
        let transfer_instruction = system_instruction::transfer(&from.key(), &to.key(), amount);
        invoke(
            &transfer_instruction,
            &[
                from.to_account_info(),
                to.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        msg!("Deposited {} SOL from account {} to the vault", amount, from.key());
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let from = &ctx.accounts.vault;
        let to = &ctx.accounts.to;

        // Ensure the vault has enough SOL to withdraw
        if from.lamports() < amount {
            return Err(ProgramError::InsufficientFunds.into());
        }

        **from.to_account_info().try_borrow_mut_lamports()? -= amount;
        **to.to_account_info().try_borrow_mut_lamports()? += amount;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(init, payer = authority, space = 8 + 32)] // Initialize the vault account
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>, // Include the system program
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)] // The sender's account (must sign the transaction)
    pub from: Signer<'info>,
    #[account(mut)] // The vault account (must be mutable)
    /// CHECK: This is the vault account where SOL is deposited. It is safe because the program controls it.
    pub vault: AccountInfo<'info>,
    /// CHECK: The system program is a known and trusted program.
    pub system_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)] // The vault account (must be mutable)
    /// CHECK: This is the vault account where SOL is stored. It is safe because the program controls it.
    pub vault: AccountInfo<'info>,
    #[account(mut)] // The recipient's account (must sign the transaction)
    pub to: Signer<'info>,
    /// CHECK: The system program is a known and trusted program.
    pub system_program: AccountInfo<'info>,
}

#[account]
pub struct Vault {
    pub owner: Pubkey, // The owner of the vault
}