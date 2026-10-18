<template>
    <div
        ref="converterRef"
        class="az-converter"
        :class="{ 'az-converter--textarea': textareaVisible }"
    >
        <BlockImageFile
            v-if="image"
            :image="image"
            @remove="onRemoveImage"
        />

        <BlockTextarea
            v-else-if="textareaVisible"
            ref="textareaRef"
            v-model="value"
            auto-size
            :error="error"
            fill
            spellcheck="false"
            @beforeinput="onBeforeInput"
            @keydown="onHistoryKeydown"
            @compositionend="onCompositionEnd"
            @compositionstart="isComposing = true"
            @input="onTextareaInput"
        >
            <template #label>
                <span>Content to convert</span>
                <span
                    v-if="contentType"
                    class="az-converter__format"
                >{{ contentType }}</span>
            </template>
        </BlockTextarea>

        <BlockInput
            v-else
            ref="inputRef"
            v-model="value"
            :error="error"
            spellcheck="false"
            type="text"
            @beforeinput="onBeforeInput"
            @keydown="onHistoryKeydown"
            @compositionend="onCompositionEnd"
            @compositionstart="isComposing = true"
            @input="onInput"
            @paste="onInputPaste"
        >
            <template #label>
                <span>Content to convert</span>
                <span
                    v-if="contentType"
                    class="az-converter__format"
                >{{ contentType }}</span>
            </template>

            <template
                v-if="!value"
                #append
            >
                <BlockImageUpload @select="onSelectImage" />
            </template>
        </BlockInput>

        <BlockResult
            :image-result="imageResult"
            :result="result"
        />

        <div class="az-converter__buttons">
            <button
                v-if="hasResult"
                ref="resetButtonRef"
                class="az-converter__button az-converter__button--rose"
                type="button"
                @click="onReset"
            >
                Reset
            </button>

            <template v-else>
                <button
                    v-if="contentType !== 'BASE64' || !isImageBase64Input"
                    class="az-converter__button az-converter__button--mint"
                    type="button"
                    @click="onConvertToBase64"
                >
                    Convert to Base64
                </button>

                <button
                    class="az-converter__button az-converter__button--rose"
                    type="button"
                    @click="onDecodeFromBase64"
                >
                    Decode Base64
                </button>

                <button
                    v-if="contentType !== 'BASE64' || !isImageBase64Input"
                    class="az-converter__button az-converter__button--navy"
                    type="button"
                    @click="indexTableOpen = true"
                >
                    Base64 index table
                </button>
            </template>
        </div>
    </div>

    <BlockModal
        v-model="indexTableOpen"
        title="Base64 index table"
    >
        <div class="az-converter__index-table">
            <BlockIndexTable />
        </div>
    </BlockModal>
</template>

<script lang="ts" setup>
import {
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    useTemplateRef,
    watch
} from 'vue'

import { useBase64Converter } from '@/composables/useBase64Converter'
import { useFieldHistory } from '@/composables/useFieldHistory'

import BlockImageFile from '@/components/BlockImageFile.vue'
import BlockImageUpload from '@/components/BlockImageUpload.vue'
import BlockIndexTable from '@/components/BlockIndexTable.vue'
import BlockInput from '@/components/BlockInput.vue'
import BlockModal from '@/components/BlockModal.vue'
import BlockResult from '@/components/BlockResult.vue'
import BlockTextarea from '@/components/BlockTextarea.vue'

import type { FieldHistoryState } from '@/types/base64Converter'

type FieldInputMetrics = Parameters<InstanceType<typeof BlockTextarea>['fitsSingleLine']>[0]

const {
    clearAll,
    clearImage,
    contentType,
    convertToBase64,
    decodeFromBase64,
    error,
    hasImage,
    hasResult,
    image,
    imageResult,
    isImageBase64Input,
    result,
    selectImage,
    value
} = useBase64Converter()

const {
    clearFieldHistory,
    getFieldHistoryState,
    hasFieldHistory,
    recordFieldHistory,
    restoreFieldHistory,
    synchronizeFieldHistory
} = useFieldHistory()

const converterRef = useTemplateRef<HTMLDivElement>('converterRef')
const inputRef = useTemplateRef<InstanceType<typeof BlockInput>>('inputRef')
const resetButtonRef = useTemplateRef<HTMLButtonElement>('resetButtonRef')
const textareaRef = useTemplateRef<InstanceType<typeof BlockTextarea>>('textareaRef')
const textareaVisible = ref(false)
const indexTableOpen = ref(false)
const isComposing = ref(false)
let inputMetrics: FieldInputMetrics | undefined
let resizeObserver: ResizeObserver | undefined
let pendingInputState: FieldHistoryState | undefined

const getInputElement = () => {
    return inputRef.value?.getInputElement()
}

const rememberInputMetrics = (input: HTMLInputElement) => {
    const field = input.parentElement

    if (!field) {
        return
    }

    const style = getComputedStyle(input)
    const fieldStyle = getComputedStyle(field)
    const fieldPadding = Number.parseFloat(fieldStyle.paddingInlineStart)
        + Number.parseFloat(fieldStyle.paddingInlineEnd)

    inputMetrics = {
        font: style.font,
        inlineSpace: field.clientWidth - fieldPadding - input.clientWidth,
        letterSpacing: style.letterSpacing
    }
}

const switchToTextareaIfNeeded = async () => {
    await nextTick()

    const input = getInputElement()

    if (isComposing.value || !input || input.scrollWidth <= input.clientWidth) {
        return
    }

    const wasFocused = input.ownerDocument.activeElement === input

    rememberInputMetrics(input)

    const selectionStart = input?.selectionStart ?? value.value.length
    const selectionEnd = input?.selectionEnd ?? selectionStart
    const selectionDirection = input?.selectionDirection ?? 'none'
    const openedBy = inputRef.value?.getFocusOrigin() ?? 'mouse'

    textareaVisible.value = true
    await nextTick()

    if (wasFocused) {
        textareaRef.value?.focusTextarea(openedBy, selectionStart, selectionEnd, selectionDirection)
    }
}

const switchToInputIfPossible = async () => {
    if (
        isComposing.value
        || value.value.includes('\n')
        || !inputMetrics
        || !textareaRef.value?.fitsSingleLine(inputMetrics)
    ) {
        return
    }

    const textarea = textareaRef.value.getTextareaElement()
    const textareaWasFocused = textarea?.ownerDocument.activeElement === textarea
    const selection = textareaRef.value.getSelection()

    textareaVisible.value = false
    await nextTick()

    const input = getInputElement()

    if (!input || !selection || !textareaWasFocused) {
        return
    }

    inputRef.value?.focusInput(selection.openedBy)
    input.setSelectionRange(selection.start, selection.end, selection.direction)
}

const clearInputHistory = () => {
    pendingInputState = undefined
    clearFieldHistory()
}

const recordInputHistory = (event?: Event) => {
    const inputEvent = event as InputEvent | undefined

    if (inputEvent?.inputType === 'historyUndo' || inputEvent?.inputType === 'historyRedo') {
        const field = inputEvent.target as HTMLInputElement | HTMLTextAreaElement

        synchronizeFieldHistory(
            pendingInputState,
            getFieldHistoryState(field),
            inputEvent.inputType === 'historyRedo'
        )
        pendingInputState = undefined
        return
    }

    if (isComposing.value || !pendingInputState) {
        return
    }

    if (pendingInputState.value !== value.value) {
        recordFieldHistory(pendingInputState)
    }

    pendingInputState = undefined
}

const restoreInputHistory = async (redo: boolean) => {
    const field = textareaVisible.value
        ? textareaRef.value?.getTextareaElement()
        : getInputElement()

    if (!field) {
        return
    }

    const state = restoreFieldHistory(getFieldHistoryState(field), redo)

    if (!state) {
        return
    }

    const openedBy = textareaVisible.value
        ? textareaRef.value?.getSelection()?.openedBy
        : inputRef.value?.getFocusOrigin()

    pendingInputState = undefined
    value.value = state.value
    await nextTick()

    if (textareaVisible.value) {
        await switchToInputIfPossible()
    } else if (state.value.includes('\n')) {
        const input = getInputElement()

        if (input) {
            rememberInputMetrics(input)
        }

        textareaVisible.value = true
        await nextTick()
    } else {
        await switchToTextareaIfNeeded()
    }

    if (textareaVisible.value) {
        textareaRef.value?.focusTextarea(openedBy, state.start, state.end, state.direction)
        return
    }

    inputRef.value?.focusInput(openedBy)
    getInputElement()?.setSelectionRange(state.start, state.end, state.direction)
}

const onBeforeInput = (event: InputEvent) => {
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
        if (event.cancelable && hasFieldHistory(event.inputType === 'historyRedo')) {
            event.preventDefault()
            void restoreInputHistory(event.inputType === 'historyRedo')
        } else {
            pendingInputState = getFieldHistoryState(event.target as HTMLInputElement | HTMLTextAreaElement)
        }

        return
    }

    if (!pendingInputState) {
        pendingInputState = getFieldHistoryState(event.target as HTMLInputElement | HTMLTextAreaElement)
    }
}

const onHistoryKeydown = (event: KeyboardEvent) => {
    if (isComposing.value || event.isComposing || event.altKey || (!event.ctrlKey && !event.metaKey)) {
        return
    }

    const key = event.key.toLowerCase()
    const undo = key === 'z' && !event.shiftKey
    const redo = (key === 'z' && event.shiftKey) || (key === 'y' && !event.metaKey)

    if ((!undo && !redo) || !hasFieldHistory(redo)) {
        return
    }

    event.preventDefault()
    void restoreInputHistory(redo)
}

const onInput = async (event?: Event) => {
    recordInputHistory(event)

    if (isComposing.value || (event as InputEvent | undefined)?.isComposing) {
        return
    }

    await nextTick()

    if (!value.value) {
        return
    }

    await switchToTextareaIfNeeded()
}

const onInputPaste = async (event: ClipboardEvent) => {
    const text = event.clipboardData?.getData('text/plain')
    const input = getInputElement()

    if (!text || !/[\r\n]/.test(text) || !input) {
        return
    }

    event.preventDefault()
    pendingInputState = getFieldHistoryState(input)

    const start = input.selectionStart ?? value.value.length
    const end = input.selectionEnd ?? start
    const openedBy = inputRef.value?.getFocusOrigin() ?? 'mouse'
    const pastedText = text.replace(/\r\n?/g, '\n')
    const selection = start + pastedText.length

    rememberInputMetrics(input)
    value.value = value.value.slice(0, start) + pastedText + value.value.slice(end)
    recordInputHistory()
    textareaVisible.value = true
    await nextTick()
    textareaRef.value?.focusTextarea(openedBy, selection, selection)
}

const onTextareaInput = async (event?: Event) => {
    recordInputHistory(event)

    if (isComposing.value || (event as InputEvent | undefined)?.isComposing) {
        return
    }

    await nextTick()
    await switchToInputIfPossible()
}

const onCompositionEnd = async () => {
    isComposing.value = false

    if (textareaVisible.value) {
        await onTextareaInput()
        return
    }

    await onInput()
}

const showTextResultLayout = async () => {
    if (!hasResult.value || imageResult.value) {
        return
    }

    const input = getInputElement()

    if (input) {
        rememberInputMetrics(input)
    }

    textareaVisible.value = true
    await nextTick()
}

const onConvertToBase64 = async () => {
    const activeElement = document.activeElement

    convertToBase64()

    if (!hasResult.value) {
        return
    }

    await showTextResultLayout()

    if (document.activeElement === activeElement
        || (document.activeElement === document.body && !activeElement?.isConnected)) {
        resetButtonRef.value?.focus()
    }
}

const onDecodeFromBase64 = async () => {
    const activeElement = document.activeElement

    await decodeFromBase64()

    if (!hasResult.value) {
        return
    }

    if (imageResult.value) {
        textareaVisible.value = false
        await nextTick()

        if (document.activeElement === activeElement
            || (document.activeElement === document.body && !activeElement?.isConnected)) {
            resetButtonRef.value?.focus()
        }

        return
    }

    await showTextResultLayout()

    if (document.activeElement === activeElement
        || (document.activeElement === document.body && !activeElement?.isConnected)) {
        resetButtonRef.value?.focus()
    }
}

const onRemoveImage = async () => {
    clearImage()
    textareaVisible.value = false

    await nextTick()
    inputRef.value?.focusInput()
}

const onReset = async () => {
    clearInputHistory()
    clearAll()
    textareaVisible.value = false

    await nextTick()
    inputRef.value?.focusInput()
}

const onSelectImage = async (file?: File) => {
    const activeElement = document.activeElement

    await selectImage(file)

    if (hasImage.value) {
        clearInputHistory()
        textareaVisible.value = false
        await nextTick()

        if (document.activeElement === activeElement
            || (document.activeElement === document.body && !activeElement?.isConnected)) {
            resetButtonRef.value?.focus()
        }
    }
}

watch(() => contentType.value === 'BASE64' && isImageBase64Input.value, async (isImageBase64) => {
    if (!isImageBase64) {
        return
    }

    const activeElement = document.activeElement

    if (!(activeElement instanceof HTMLButtonElement)
        || !converterRef.value?.contains(activeElement)
        || !activeElement.matches('.az-converter__button--mint, .az-converter__button--navy')) {
        return
    }

    await nextTick()

    if (!hasResult.value
        && (document.activeElement === activeElement
            || (document.activeElement === document.body && !activeElement.isConnected))) {
        converterRef.value?.querySelector<HTMLButtonElement>(
            '.az-converter__buttons > .az-converter__button--rose'
        )?.focus()
    }
})

onMounted(() => {
    resizeObserver = new ResizeObserver(() => {
        if (textareaVisible.value && !hasResult.value) {
            void switchToInputIfPossible()
            return
        }

        void switchToTextareaIfNeeded()
    })

    if (converterRef.value) {
        resizeObserver.observe(converterRef.value)
    }
})

onBeforeUnmount(() => {
    resizeObserver?.disconnect()
})
</script>

<style lang="scss" scoped>
.az-converter {
    width: 100%;
    min-height: 0;
    padding-inline: 36px;
    flex: 1;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 36px;
    color: $color-grey-400;

    @media (max-width: 360px) {
        padding-inline: 24px;
    }

    &--textarea {
        grid-template-rows: minmax(0, 1fr) minmax(0, 1fr) auto;
    }

    &__index-table {
        width: 100%;
        min-width: 0;
    }

    &__format {
        padding: 0 4px;
        font-size: 13px;
        color: $color-grey-200;
    }

    &__buttons {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    &__button {
        width: 100%;
        padding: 20px 28px;
        border-radius: 12px;
        font-size: 18px;
        font-weight: 500;
        line-height: 1em;
        color: $color-milk-100;
        text-transform: uppercase;

        &:focus-visible {
            @include focus-ring($color-grey-400, 12px);
        }

        &--mint {
            background: $color-mint-300;

            &:hover {
                background: $color-mint-400;
            }
        }

        &--rose {
            background: $color-rose-200;

            &:hover {
                background: $color-rose-300;
            }
        }

        &--navy {
            background: $color-navy-200;

            &:hover {
                background: $color-navy-300;
            }
        }
    }
}
</style>