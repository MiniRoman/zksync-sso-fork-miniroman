<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script lang="ts" setup>
import { createAppKit } from "@reown/appkit/vue";

const { defaultChain } = useClientStore();
const { metadata, projectId, wagmiAdapter } = useAppKit();

// BigInt polyfill
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

createAppKit({
  adapters: [wagmiAdapter],
  networks: [defaultChain],
  projectId,
  metadata,
});
</script>
