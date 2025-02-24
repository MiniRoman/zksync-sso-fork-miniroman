<template>
  <div class="min-h-screen">
    <header class="max-w-[1920px] mx-auto mb-12">
      <app-generic-nav />
    </header>
    <main class="max-w-[900px] mx-auto flex flex-col gap-6">
      <CommonStepper
        :current-step="currentStep"
        :total-steps="3"
      />

      <div class="flex flex-col items-center gap-8 mt-4">
        <h1 class="text-3xl font-medium text-neutral-900 dark:text-neutral-100">
          {{ stepTitle }}
        </h1>

        <!-- Step 1: Input Address -->
        <div
          v-if="currentStep === 1"
          class="w-full max-w-md flex flex-col gap-6"
        >
          <div class="flex flex-col gap-2">
            <label
              for="address"
              class="text-sm text-neutral-700 dark:text-neutral-300"
            >
              Insert your address
            </label>
            <ZkInput
              id="address"
              v-model="address"
              placeholder="0x..."
              :error="!!addressError"
              :messages="addressError ? [addressError] : undefined"
              @input="validateAddress"
            />
          </div>

          <ZkLink
            class="text-sm text-center w-fit text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors hover:border-b-neutral-900 dark:hover:border-b-neutral-100"
            href="/recovery/guardian/find-account"
          >
            I don't remember my address
          </ZkLink>

          <ZkButton
            class="w-full"
            :disabled="!isValidAddress || isValidatingAccount"
            :loading="isValidatingAccount"
            @click="handleContinue"
          >
            Continue
          </ZkButton>
        </div>

        <account-recovery-passkey-generation-flow
          v-if="currentStep >= 2"
          v-model:current-step="currentStep"
          v-model:new-passkey="newPasskey"
          :generate-passkeys-step="2"
          :confirmation-step="3"
          :address="address"
          :register-in-progress="registerInProgress"
          @back="currentStep = 1"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { RegisterNewPasskeyReturnType } from "zksync-sso/client/passkey";

import { useValidateAccount } from "~/composables/useValidateAccount";
import { AddressSchema } from "~/utils/schemas";

definePageMeta({
  layout: "dashboard",
});

const currentStep = ref(1);
const address = ref("");
const addressError = ref("");
const isValidAddress = ref(false);
const newPasskey = ref<RegisterNewPasskeyReturnType | null>(null);

const { inProgress: registerInProgress } = usePasskeyRegister();
const { validateAccount, isValidatingAccount } = useValidateAccount();

const stepTitle = computed(() => {
  switch (currentStep.value) {
    case 1:
      return "Start Recovery";
    case 2:
      return "Generate Passkeys";
    case 3:
      return "Recovery Started";
    default:
      return "";
  }
});

const validateAddress = async () => {
  const result = AddressSchema.safeParse(address.value);
  if (!result.success) {
    addressError.value = "Not a valid address";
    isValidAddress.value = false;
    return;
  }

  // Reset errors without enabling the Continue button just yet
  addressError.value = "";
  isValidAddress.value = false;

  const isValid = await validateAccount(result.data);
  if (!isValid) {
    addressError.value = "The address is not a valid ZKsync SSO account";
    isValidAddress.value = false;

    // At this point we deliberately ignore errors coming from
    // account validation, as they could stem from erc-165 not being
    // supported by the input address.
    return;
  }

  addressError.value = "";
  isValidAddress.value = true;
};

const handleContinue = () => {
  if (isValidAddress.value) {
    currentStep.value = 2;
  }
};
</script>
