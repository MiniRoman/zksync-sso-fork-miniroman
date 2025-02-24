import type { Account, Address, Chain, Client, Transport } from "viem";
import { decodeAbiParameters } from "viem";
import { GuardianRecoveryModuleAbi } from "zksync-sso/abi";
import { confirmGuardian as sdkConfirmGuardian } from "zksync-sso/client";

const getGuardiansInProgress = ref(false);
const getGuardiansError = ref<Error | null>(null);
const getGuardiansData = ref<readonly { addr: Address; isReady: boolean }[] | null>(null);

export const useRecoveryGuardian = () => {
  const { getClient, getPublicClient, getWalletClient, getRecoveryClient, defaultChain } = useClientStore();
  const paymasterAddress = contractsByChain[defaultChain!.id].accountPaymaster;

  const getGuardedAccountsInProgress = ref(false);
  const getGuardedAccountsError = ref<Error | null>(null);

  async function getGuardedAccounts(guardianAddress: Address) {
    getGuardedAccountsInProgress.value = true;
    getGuardedAccountsError.value = null;

    try {
      const client = getPublicClient({ chainId: defaultChain.id });
      return await client.readContract({
        address: contractsByChain[defaultChain.id].recovery,
        abi: GuardianRecoveryModuleAbi,
        functionName: "guardianOf",
        args: [guardianAddress],
      });
    } catch (err) {
      getGuardedAccountsError.value = err as Error;
      return [];
    } finally {
      getGuardedAccountsInProgress.value = false;
    }
  }

  async function getGuardians(guardedAccount: Address) {
    getGuardiansInProgress.value = true;
    getGuardiansError.value = null;

    try {
      const client = getPublicClient({ chainId: defaultChain.id });
      const data = await client.readContract({
        address: contractsByChain[defaultChain.id].recovery,
        abi: GuardianRecoveryModuleAbi,
        functionName: "guardiansFor",
        args: [guardedAccount],
      });
      getGuardiansData.value = data;
      return;
    } catch (err) {
      getGuardiansError.value = err as Error;
      return [];
    } finally {
      getGuardiansInProgress.value = false;
    }
  }

  const getRecoveryInProgress = ref(false);
  const getRecoveryError = ref<Error | null>(null);

  async function getRecovery(account: Address) {
    getRecoveryInProgress.value = true;
    getRecoveryError.value = null;

    try {
      const client = getPublicClient({ chainId: defaultChain.id });
      return await client.readContract({
        address: contractsByChain[defaultChain.id].recovery,
        abi: GuardianRecoveryModuleAbi,
        functionName: "pendingRecoveryData",
        args: [account],
      });
    } catch (err) {
      getRecoveryError.value = err as Error;
      return [];
    } finally {
      getRecoveryInProgress.value = false;
    }
  }

  const { inProgress: proposeGuardianInProgress, error: proposeGuardianError, execute: proposeGuardian } = useAsync(async (address: Address) => {
    const client = getClient({ chainId: defaultChain.id });
    return await client.proposeGuardian({
      newGuardian: address,
      paymaster: {
        address: paymasterAddress,
      },
    });
  });

  const { inProgress: removeGuardianInProgress, error: removeGuardianError, execute: removeGuardian } = useAsync(async (address: Address) => {
    const client = getClient({ chainId: defaultChain.id });
    const tx = await client.removeGuardian({
      guardian: address,
      paymaster: {
        address: paymasterAddress,
      },
    });
    getGuardians(client.account.address);
    return tx;
  });

  const { inProgress: confirmGuardianInProgress, error: confirmGuardianError, execute: confirmGuardian } = useAsync(async <transport extends Transport, chain extends Chain, account extends Account>({ client, accountToGuard }: { client: Client<transport, chain, account>; accountToGuard: Address }) => {
    return await sdkConfirmGuardian(client, {
      accountToGuard,
      contracts: {
        recovery: contractsByChain[defaultChain.id].recovery,
      },
      paymaster: {
        address: paymasterAddress,
      },
    });
  });

  const { inProgress: getPendingRecoveryDataInProgress, error: getPendingRecoveryDataError, execute: getPendingRecoveryData, result: getPendingRecoveryDataResult } = useAsync(async (account: Address) => {
    const client = getPublicClient({ chainId: defaultChain.id });
    return await client.readContract({
      address: contractsByChain[defaultChain.id].recovery,
      abi: GuardianRecoveryModuleAbi,
      functionName: "pendingRecoveryData",
      args: [account],
    });
  });

  const { inProgress: discardRecoveryInProgress, error: discardRecoveryError, execute: discardRecovery } = useAsync(async () => {
    const client = getClient({ chainId: defaultChain.id });
    return await client.writeContract({
      address: contractsByChain[defaultChain.id].recovery,
      abi: GuardianRecoveryModuleAbi,
      functionName: "discardRecovery",
    });
  });

  const { inProgress: initRecoveryInProgress, error: initRecoveryError, execute: initRecovery } = useAsync(async (account: Address, encodedPassKeyParams: `0x${string}`, accountId: `0x${string}`) => {
    const client = await getWalletClient({ chainId: defaultChain.id });
    const [address] = await client.getAddresses();

    const tx = await client.writeContract({
      account: address,
      address: contractsByChain[defaultChain.id].recovery,
      abi: GuardianRecoveryModuleAbi,
      functionName: "initRecovery",
      args: [account, encodedPassKeyParams, accountId],
    });
    return tx;
  });

  const { inProgress: checkRecoveryRequestInProgress, error: checkRecoveryRequestError, execute: checkRecoveryRequest } = useAsync(async (accountId: string) => {
    const client = getPublicClient({ chainId: defaultChain.id });
    const tx = await client.readContract({
      address: contractsByChain[defaultChain.id].recovery,
      abi: GuardianRecoveryModuleAbi,
      functionName: "checkRecoveryRequest",
      args: [accountId],
    });
    return tx;
  });

  const { inProgress: executeRecoveryInProgress, error: executeRecoveryError, execute: executeRecovery } = useAsync(async (address: Address) => {
    const recoveryClient = await getRecoveryClient({ chainId: defaultChain.id, address });
    const pendingRecovery = await getPendingRecoveryData(address);

    const [credentialId, passkeyPublicKey, domain] = decodeAbiParameters([
      {
        name: "credentialId",
        type: "bytes",
      },
      {
        name: "rawPublicKey",
        type: "bytes32[2]",
      },
      {
        name: "originDomain",
        type: "string",
      },
    ], pendingRecovery![0]!);
    const tx = await recoveryClient.addAccountOwnerPasskey({
      credentialId,

      passkeyPublicKey: [...passkeyPublicKey],
      domain,
      paymaster: {
        address: paymasterAddress,
      },
    });
    return tx;
  });

  return {
    confirmGuardianInProgress,
    confirmGuardianError,
    confirmGuardian,
    proposeGuardianInProgress,
    proposeGuardianError,
    proposeGuardian,
    removeGuardianInProgress,
    removeGuardianError,
    removeGuardian,
    initRecoveryInProgress,
    initRecoveryError,
    initRecovery,
    getGuardedAccountsInProgress,
    getGuardedAccountsError,
    getGuardedAccounts,
    getGuardiansInProgress,
    getGuardiansError,
    getGuardiansData,
    getGuardians,
    getPendingRecoveryDataInProgress,
    getPendingRecoveryDataError,
    getPendingRecoveryData,
    getPendingRecoveryDataResult,
    discardRecoveryInProgress,
    discardRecoveryError,
    discardRecovery,
    getRecoveryInProgress,
    getRecoveryError,
    getRecovery,
    checkRecoveryRequestInProgress,
    checkRecoveryRequestError,
    checkRecoveryRequest,
    executeRecoveryInProgress,
    executeRecoveryError,
    executeRecovery,
  };
};
