<template>
    <div class="az-image-upload">
        <input
            ref="fileInputRef"
            class="az-image-upload__input"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            tabindex="-1"
            aria-hidden="true"
            @change="onChange"
        >

        <button
            class="az-image-upload__button"
            type="button"
            aria-label="Select image"
            @click="openFileDialog"
        >
            <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
            >
                <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 2v10.17l3.59-3.58a2 2 0 0 1 2.82 0L14 14.17l1.59-1.58a2 2 0 0 1 2.82 0L19 13.17V5H5Zm0 14h14v-3l-2-2-3 3-4-4L5 18v1Zm10.5-8a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
            </svg>
        </button>
    </div>
</template>

<script lang="ts" setup>
import { useTemplateRef } from 'vue'

const emit = defineEmits<{
    select: [file?: File]
}>()

const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef')

const openFileDialog = () => {
    fileInputRef.value?.click()
}

const onChange = (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]

    emit('select', file)
    input.value = ''
}
</script>

<style lang="scss" scoped>
.az-image-upload {
    &__input {
        position: absolute;
        overflow: hidden;
        width: 1px;
        height: 1px;
        clip-path: inset(50%);
    }

    &__button {
        width: 44px;
        height: 44px;
        padding: 8px;
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: 50%;

        &:hover {
            svg {
                fill: $color-grey-400;
            }
        }

        &:focus-visible {
            @include focus-ring($color-grey-400, 50%);
        }

        svg {
            width: 26px;
            height: 26px;
            fill: $color-milk-400;
        }
    }
}
</style>