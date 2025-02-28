import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaDepositWithdrawn } from "../target/types/solana_deposit_withdrawn";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { PublicKey, SystemProgram, Keypair } from '@solana/web3.js';
import { expect } from "chai";
import { readFileSync } from 'fs';

const ADDRESS = new PublicKey("6GJBeuJUCxsYnwiWpyzqyAaSTz5UrxmWVck1HBDUPaYd");
const IDL = JSON.parse(readFileSync('./target/idl/solana_deposit_withdrawn.json', 'utf8'));

describe("solana_deposit_withdrawn", () => {
  let provider: BankrunProvider;
  let depositProgram: Program<SolanaDepositWithdrawn>;
  let vault: PublicKey;

  before(async () => {
    const context = await startAnchor("", [{ name: "solana_deposit_withdrawn", programId: ADDRESS }], []);
    provider = new BankrunProvider(context);
    depositProgram = new Program<SolanaDepositWithdrawn>(IDL, provider);

    // Initialize the vault account
    const vaultKeypair = Keypair.generate();
    vault = vaultKeypair.publicKey;
    await depositProgram.methods
      .initializeVault()
      .accounts({
        vault: vault,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([vaultKeypair])
      .rpc();
  });

  it("Should allow deposits", async () => {
    const DEPOSIT_AMOUNT = new anchor.BN(1000 * anchor.web3.LAMPORTS_PER_SOL);

    // Deposit SOL into the vault
    await depositProgram.methods
      .deposit(DEPOSIT_AMOUNT)
      .accounts({
        from: provider.wallet.publicKey,
        vault: vault,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Fetch the vault's balance
    const vaultAccountInfo = await provider.connection.getAccountInfo(vault);
    const vaultBalance = vaultAccountInfo ? vaultAccountInfo.lamports : 0;


    // Allow a small tolerance for rent-exempt minimums
    const tolerance = 1000000; // 0.001 SOL

    const rentExemptBalance = await provider.connection.getMinimumBalanceForRentExemption(8 + 32); // Size of Vault struct
    expect(vaultBalance).to.be.closeTo(DEPOSIT_AMOUNT.toNumber() + rentExemptBalance, tolerance);
  });

  it("Should allow withdrawals", async () => {
    const WITHDRAW_AMOUNT = new anchor.BN(500 * anchor.web3.LAMPORTS_PER_SOL);

    // Withdraw SOL from the vault
    await depositProgram.methods
      .withdraw(WITHDRAW_AMOUNT)
      .accounts({
        vault: vault,
        to: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Fetch the vault's balance after withdrawal
    const vaultAccountInfo = await provider.connection.getAccountInfo(vault);
    const vaultBalance = vaultAccountInfo ? vaultAccountInfo.lamports : 0;

    // Allow a small tolerance for rent-exempt minimums
    const tolerance = 1000000; // 0.001 SOL
    const rentExemptBalance = await provider.connection.getMinimumBalanceForRentExemption(8 + 32); // Size of Vault struct
    expect(vaultBalance).to.be.closeTo((500 * anchor.web3.LAMPORTS_PER_SOL) + rentExemptBalance, tolerance);
  });
});