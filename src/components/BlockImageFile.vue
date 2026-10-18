<template>
    <div class="az-image-file">
        <div class="az-image-file__label">
            <span>Content to convert</span>
            <span class="az-image-file__format">{{ contentType }}</span>
        </div>

        <div class="az-image-file__field">
            <img
                class="az-image-file__preview"
                :src="image.source"
                alt=""
            >

            <div class="az-image-file__content">
                <span class="az-image-file__name">{{ image.name }}</span>
                <span class="az-image-file__details">{{ imageDetails }}</span>
            </div>

            <button
                class="az-image-file__remove"
                type="button"
                aria-label="Remove image"
                @click="emit('remove')"
            >
                <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                >
                    <path d="m6.7 5.3 5.3 5.3 5.3-5.3 1.4 1.4-5.3 5.3 5.3 5.3-1.4 1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4Z" />
                </svg>
            </button>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

import type {
    ContentType,
    Image
} from '@/types/base64Converter'

const { image } = defineProps<{
    image: Image
}>()

const contentType: ContentType = 'IMAGE'

const emit = defineEmits<{
    remove: []
}>()

const formattedSize = computed(() => {
    if (image.size < 1000 * 1000) {
        return `${Math.round(image.size / 1000)} KB`
    }

    return `${(image.size / (1000 * 1000)).toFixed(1)} MB`
})

const imageDetails = computed(() => {
    return `${image.width} × ${image.height} px (${formattedSize.value})`
})
</script>

<style lang="scss" scoped>
.az-image-file {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;

    &__label {
        padding-inline: 4px;
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 4px;
        font-size: 15px;
        line-height: 1em;
        color: $color-milk-400;
    }

    &__format,
    &__details {
        font-size: 13px;
        color: $color-grey-200;
    }

    &__format {
        padding: 0 4px;
    }

    &__field {
        width: 100%;
        min-width: 0;
        min-height: 76px;
        padding: 12px 12px 12px 24px;
        display: flex;
        align-items: center;
        gap: 12px;
        background: $color-milk-100;
        border-radius: 38px;
        border: 4px solid $color-milk-100;

        @media (max-width: 360px) {
            padding-inline: 12px;
        }
    }

    &__preview {
        width: 44px;
        height: 44px;
        display: block;
        flex-shrink: 0;
        object-fit: contain;
    }

    &__content {
        min-width: 0;
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 4px;
    }

    &__name,
    &__details {
        overflow: hidden;
        line-height: 1em;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    &__details {
        text-transform: none;
    }

    &__name {
        font-size: 15px;
        color: $color-milk-400;
    }

    &__remove {
        width: 44px;
        height: 44px;
        display: flex;
        flex-shrink: 0;
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