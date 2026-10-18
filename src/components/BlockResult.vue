<template>
    <div class="az-result">
        <p
            class="az-result__status"
            role="status"
            aria-atomic="true"
        >
            {{ status }}
        </p>

        <div class="az-result__headline">
            <span>Result</span>

            <button
                v-if="imageResult"
                class="az-result__action"
                type="button"
                @click="downloadImage"
            >
                Download
            </button>

            <button
                v-else-if="result"
                class="az-result__action"
                type="button"
                @click="copyResult"
            >
                {{ copied ? 'Copied' : 'Copy' }}
            </button>
        </div>

        <p
            v-if="copyError"
            class="az-result__error"
            role="alert"
        >
            {{ copyError }}
        </p>

        <div
            v-if="imageResult"
            class="az-result__image-wrapper"
        >
            <img
                class="az-result__image"
                :src="imageResult"
                alt="Decoded Base64 preview"
            >
        </div>

        <BlockTextarea
            v-else
            v-model="resultValue"
            aria-label="Conversion result"
            auto-size
            fill
            readonly
            spellcheck="false"
        />
    </div>
</template>

<script lang="ts" setup>
import {
    computed,
    onBeforeUnmount,
    ref,
    watch
} from 'vue'

import BlockTextarea from '@/components/BlockTextarea.vue'

const props = defineProps<{
    imageResult: string
    result: string
}>()

const copyFailedMessage = 'Copy failed. Select and copy manually.'
const copied = ref(false)
const copyError = ref('')
const status = ref('')
let copyOperationId = 0
let copiedTimeout: ReturnType<typeof setTimeout> | undefined

const resultValue = computed({
    get: () => props.result,
    set: () => undefined
})

const copyResult = async () => {
    const currentOperationId = ++copyOperationId
    const currentResult = props.result

    clearTimeout(copiedTimeout)
    copied.value = false
    copyError.value = ''
    status.value = ''

    if (!navigator.clipboard?.writeText) {
        copyError.value = copyFailedMessage
        return
    }

    try {
        await navigator.clipboard.writeText(currentResult)

        if (currentOperationId !== copyOperationId || currentResult !== props.result) {
            return
        }

        copied.value = true
        status.value = 'Result copied to clipboard.'
        copiedTimeout = setTimeout(() => {
            copied.value = false
        }, 1500)
    } catch {
        if (currentOperationId === copyOperationId) {
            copyError.value = copyFailedMessage
        }
    }
}

const downloadImage = () => {
    const mimeType = props.imageResult.match(/^data:(image\/[a-z0-9.+-]+);base64,/i)?.[1] ?? 'image/png'
    const extension = mimeType === 'image/jpeg'
        ? 'jpg'
        : mimeType.split('/')[1] ?? 'png'
    const base64 = props.imageResult.split(',')[1] ?? ''
    const firstCharacters = base64.slice(0, 4)
    const lastCharacters = base64.slice(-4)
    const link = document.createElement('a')

    link.href = props.imageResult
    link.download = `AD2M-${firstCharacters}-${lastCharacters}.${extension}`
    link.click()
}

watch(() => [props.result, props.imageResult], () => {
    copyOperationId += 1
    clearTimeout(copiedTimeout)
    copied.value = false
    copyError.value = ''
    status.value = props.imageResult
        ? 'Conversion complete. Image preview is available.'
        : props.result ? 'Conversion complete. Text result is available.' : ''
})

onBeforeUnmount(() => {
    copyOperationId += 1
    clearTimeout(copiedTimeout)
})
</script>

<style lang="scss" scoped>
.az-result {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;

    &__status {
        position: absolute;
        overflow: hidden;
        width: 1px;
        height: 1px;
        padding: 0;
        border: 0;
        clip-path: inset(50%);
        white-space: nowrap;
    }

    &__error {
        padding-inline: 4px;
        font-size: 15px;
        line-height: 1.5em;
        color: $color-milk-500;
    }

    &__headline {
        min-height: 15px;
        padding-inline: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 15px;
        line-height: 1em;
        color: $color-milk-400;
        text-align: left;
    }

    &__action {
        color: $color-grey-200;

        &:hover {
            color: $color-milk-400;
        }

        &:focus-visible {
            @include focus-ring($color-grey-400, 4px);
        }
    }

    &__image-wrapper {
        min-height: 0;
        display: flex;
        justify-content: center;
        align-items: flex-start;
    }

    &__image {
        width: auto;
        max-width: 100%;
        height: auto;
        max-height: 344px;
        object-fit: contain;
    }

    :deep(.az-textarea) {
        height: 100%;
        min-height: 0;
    }
}
</style>