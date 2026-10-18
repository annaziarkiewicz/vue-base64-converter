<template>
    <Teleport to="body">
        <div
            v-show="modelValue"
            class="az-modal"
            @click="close"
        >
            <div
                ref="modalRef"
                class="az-modal__content"
                role="dialog"
                aria-modal="true"
                :aria-label="title"
                tabindex="-1"
                @click.stop
            >
                <button
                    ref="closeButtonRef"
                    aria-label="Close modal"
                    class="az-modal__close"
                    type="button"
                    @click="close"
                >
                    ✕
                </button>

                <slot />
            </div>
        </div>
    </Teleport>
</template>

<script lang="ts" setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { focusableSelector } from '@/composables/useIframeCommunication'

const props = defineProps<{
    modelValue: boolean
    title: string
}>()

const emit = defineEmits<{
    (event: 'update:modelValue', value: boolean): void
}>()

const modalRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)

let previousFocus: HTMLElement | null = null
let previousHtmlOverflow = ''
let previousBodyOverflow = ''
let scrollLocked = false

const close = () => {
    emit('update:modelValue', false)
}

const getFocusableElements = (): HTMLElement[] => {
    if (!modalRef.value) return []

    return Array.from(
        modalRef.value.querySelectorAll<HTMLElement>(focusableSelector)
    ).filter(element => element.getClientRects().length > 0)
}

const focusInitial = (): void => {
    if (closeButtonRef.value?.getClientRects().length) {
        closeButtonRef.value.focus()
        return
    }

    getFocusableElements()[0]?.focus()

    if (!modalRef.value?.contains(document.activeElement)) {
        modalRef.value?.focus()
    }
}

const handleFocusTrap = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return

    const focusableElements = getFocusableElements()
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    const activeElement = document.activeElement

    if (!firstElement || !lastElement) {
        event.preventDefault()
        modalRef.value?.focus()
        return
    }

    if (
        event.shiftKey
        && (
            activeElement === firstElement
            || activeElement === modalRef.value
            || !modalRef.value?.contains(activeElement)
        )
    ) {
        event.preventDefault()
        lastElement.focus()
        return
    }

    if (
        !event.shiftKey
        && (
            activeElement === lastElement
            || !modalRef.value?.contains(activeElement)
        )
    ) {
        event.preventDefault()
        firstElement.focus()
    }
}

const handleKeydown = (event: KeyboardEvent): void => {
    if (!props.modelValue) return

    if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
    }

    handleFocusTrap(event)
}

const handleFocusIn = (event: FocusEvent): void => {
    if (
        !props.modelValue
        || !(event.target instanceof Node)
        || modalRef.value?.contains(event.target)
    ) return

    focusInitial()
}

const lockScroll = (): void => {
    if (scrollLocked) return

    previousHtmlOverflow = document.documentElement.style.overflow
    previousBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    scrollLocked = true
}

const unlockScroll = (): void => {
    if (!scrollLocked) return

    document.documentElement.style.overflow = previousHtmlOverflow
    document.body.style.overflow = previousBodyOverflow
    scrollLocked = false
}

watch(
    () => props.modelValue,
    async value => {
        if (value) {
            previousFocus = document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null

            lockScroll()
            document.addEventListener('keydown', handleKeydown, true)
            document.addEventListener('focusin', handleFocusIn)

            await nextTick()

            if (props.modelValue) focusInitial()
            return
        }

        document.removeEventListener('keydown', handleKeydown, true)
        document.removeEventListener('focusin', handleFocusIn)
        unlockScroll()

        const focusTarget = previousFocus
        previousFocus = null

        await nextTick()

        if (focusTarget?.isConnected) focusTarget.focus()
    },
    { immediate: true, flush: 'post' }
)

onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeydown, true)
    document.removeEventListener('focusin', handleFocusIn)
    unlockScroll()

    if (props.modelValue && previousFocus?.isConnected) {
        previousFocus.focus()
    }
})
</script>

<style lang="scss" scoped>
.az-modal {
    position: fixed;
    inset: 0;
    z-index: 1;
    overflow-y: auto;
    display: flex;
    background: rgba($color-grey-400, .75);

    &__content {
        position: relative;
        overflow: hidden;
        width: 100%;
        max-width: 960px;
        height: 680px;
        margin: auto;
        display: flex;
        background: #B6B6AF;
        box-shadow: 0 0 48px 10px $color-grey-400;

        @media (max-width: 767px) {
            overflow: visible;
            height: auto;
            min-height: 680px;
            display: block;
        }

        @media (max-width: 480px) {
            min-height: 100%;
            display: flex;
            flex-direction: column;
        }
    }

    &__close {
        position: absolute;
        top: 30px;
        right: 30px;
        width: 44px;
        height: 44px;
        display: flex;
        justify-content: center;
        align-items: center;
        background: $color-milk-200;
        border-radius: 50%;
        font-size: 20px;
        color: $color-milk-500;
        transition: .25s;

        @media (max-width: 767px) {
            top: 24px;
            right: 24px;
        }

        &:focus-visible {
            @include focus-ring($color-grey-400, 50%);
        }

        &:hover {
            background: $color-milk-100;
        }
    }
}
</style>