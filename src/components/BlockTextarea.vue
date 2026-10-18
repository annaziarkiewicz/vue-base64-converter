<template>
    <div
        class="az-textarea"
        :class="{ 'az-textarea--fill': fill }"
        :style="textareaStyle"
    >
        <label
            v-if="label || $slots.label"
            class="az-textarea__label"
            :for="textareaId"
        >
            <slot name="label">{{ label }}</slot>
        </label>

        <div
            class="az-textarea__field"
            :class="{
                'az-textarea__field--error': ariaInvalid === 'true',
                'az-textarea__field--keyboard-focus': textareaKeyboardFocused
            }"
        >
            <textarea
                ref="textareaRef"
                v-bind="$attrs"
                :id="textareaId"
                v-model="model"
                class="az-textarea__value"
                :class="{
                    'az-textarea__value--large': activeSize === 'large',
                    'az-textarea__value--responsive': autoSize && size === 'large',
                    'az-textarea__value--small': activeSize === 'small'
                }"
                :aria-describedby="describedBy"
                :aria-invalid="ariaInvalid"
                rows="3"
                @input="emit('input', $event)"
            />
        </div>

        <div
            class="az-textarea__announcement"
            aria-live="polite"
            aria-atomic="true"
        >
            {{ error && showErrorMessage ? (errorPrefix ? `${errorPrefix}: ${error}` : error) : '' }}
        </div>

        <div
            v-if="error && showErrorMessage"
            :id="errorDescriptionId"
            class="az-textarea__error"
        >
            <span
                v-if="errorPrefix"
                class="az-textarea__error-prefix"
            >{{ errorPrefix }}:</span> {{ error }}
        </div>
    </div>
</template>

<script lang="ts" setup>
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    useTemplateRef,
    watch
} from 'vue'

import {
    useFieldAccessibility,
    useFieldFocus
} from '@/composables/useField'

type FieldInputMetrics = {
    font: string
    inlineSpace: number
    letterSpacing: string
}

type TextareaSize = 'default' | 'large' | 'small'

defineOptions({ inheritAttrs: false })

const {
    autoSize = false,
    borderColor,
    error = '',
    errorColor,
    errorPrefix = 'Error',
    fill = false,
    focusColor,
    label = '',
    showErrorMessage = true,
    size = 'default'
} = defineProps<{
    autoSize?: boolean
    borderColor?: string
    error?: string
    errorColor?: string
    errorPrefix?: string
    fill?: boolean
    focusColor?: string
    label?: string
    showErrorMessage?: boolean
    size?: TextareaSize
}>()

const emit = defineEmits<{
    input: [event: Event]
}>()

const model = defineModel<string>({ required: true })

const measuredSize = ref<TextareaSize>('default')
const textareaRef = useTemplateRef<HTMLTextAreaElement>('textareaRef')
const {
    focusField,
    getFocusOrigin,
    keyboardFocused: textareaKeyboardFocused
} = useFieldFocus(textareaRef)
let resizeObserver: ResizeObserver | undefined
let measurementContext: CanvasRenderingContext2D | null | undefined

const {
    ariaInvalid,
    describedBy,
    errorDescriptionId,
    fieldId: textareaId
} = useFieldAccessibility(() => error, () => showErrorMessage)

const activeSize = computed(() => {
    return autoSize && size === 'default' ? measuredSize.value : size
})

const textareaStyle = computed(() => {
    return {
        '--input-border-color': borderColor,
        '--input-error-color': errorColor,
        '--input-focus-color': focusColor
    }
})

const updateSize = async () => {
    if (!autoSize || size !== 'default') {
        return
    }

    await nextTick()

    const textarea = textareaRef.value

    if (!textarea || !autoSize || size !== 'default') {
        return
    }

    const previousFontSize = textarea.style.fontSize
    textarea.style.fontSize = '20px'
    measuredSize.value = textarea.scrollHeight <= textarea.clientHeight ? 'default' : 'small'
    textarea.style.fontSize = previousFontSize
}

const fitsSingleLine = (metrics: FieldInputMetrics) => {
    const textarea = textareaRef.value
    measurementContext ??= document.createElement('canvas').getContext('2d')

    const context = measurementContext
    const field = textarea?.parentElement

    if (!textarea || !field || !context) {
        return false
    }

    context.font = metrics.font

    if ('letterSpacing' in context) {
        context.letterSpacing = '0px'
    }

    const letterSpacing = Number.parseFloat(metrics.letterSpacing) || 0
    let textWidth = context.measureText(model.value).width

    if ('letterSpacing' in context) {
        context.letterSpacing = `${letterSpacing}px`
        textWidth = context.measureText(model.value).width
    } else {
        textWidth += Array.from(model.value).length * letterSpacing
    }

    const fieldStyle = getComputedStyle(field)
    const fieldPadding = Number.parseFloat(fieldStyle.paddingInlineStart)
        + Number.parseFloat(fieldStyle.paddingInlineEnd)

    return textWidth <= field.clientWidth - fieldPadding - metrics.inlineSpace
}

const getSelection = () => {
    const textarea = textareaRef.value

    if (!textarea) {
        return undefined
    }

    return {
        direction: textarea.selectionDirection,
        end: textarea.selectionEnd,
        openedBy: getFocusOrigin(),
        start: textarea.selectionStart
    }
}

const focusTextarea = (
    openedBy?: 'keyboard' | 'mouse',
    start?: number,
    end?: number,
    direction?: 'forward' | 'backward' | 'none'
) => {
    focusField(openedBy)

    const length = textareaRef.value?.value.length ?? 0
    textareaRef.value?.setSelectionRange(start ?? length, end ?? start ?? length, direction)
}

const observeSize = () => {
    resizeObserver?.disconnect()

    if (!autoSize || size !== 'default' || !textareaRef.value) {
        return
    }

    resizeObserver ??= new ResizeObserver(() => {
        void updateSize()
    })
    resizeObserver.observe(textareaRef.value)
    void updateSize()
}

watch(model, updateSize)
watch([() => autoSize, () => size], observeSize)

onMounted(observeSize)

onBeforeUnmount(() => {
    resizeObserver?.disconnect()
})

defineExpose({
    fitsSingleLine,
    focusTextarea,
    getSelection,
    getTextareaElement: () => textareaRef.value
})
</script>

<style lang="scss" scoped>
.az-textarea {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;

    &--fill {
        height: 100%;

        .az-textarea__field {
            min-height: 0;
            flex: 1;
        }

        .az-textarea__value {
            height: 100%;
        }
    }

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

    &__field {
        overflow: hidden;
        width: 100%;
        min-width: 0;
        min-height: 132px;
        padding: 12px 24px;
        display: flex;
        align-items: flex-start;
        background: $color-milk-100;
        border-radius: 38px;
        border: 4px solid var(--input-border-color, #{$color-milk-100});
        transition: border-color .25s;

        @media (max-width: 360px) {
            padding-inline: 12px;
        }

        &--keyboard-focus {
            border-color: var(--input-focus-color, #{$color-grey-400});
        }

        &--error,
        &--error:focus-within {
            border-color: var(--input-error-color, #{$color-rose-200});
        }

        &--error.az-textarea__field--keyboard-focus {
            @include focus-ring(var(--input-focus-color, #{$color-grey-400}), 38px);
        }
    }

    &__value {
        overflow-x: hidden;
        overflow-y: scroll;
        width: 100%;
        min-width: 0;
        height: 100px;
        display: block;
        flex: 1;
        resize: none;
        outline: none;
        scrollbar-color: $color-milk-300 $color-milk-100;
        font-size: 20px;
        line-height: 1.5em;
        color: $color-milk-500;

        &::-webkit-scrollbar {
            width: 8px;
        }

        &::-webkit-scrollbar-track {
            background: $color-milk-100;
        }

        &::-webkit-scrollbar-thumb {
            background: $color-milk-300;
        }

        &--large {
            font-size: 24px;
        }

        &--responsive {
            @media (max-width: 767px) {
                font-size: 15px;
            }
        }

        &--small {
            font-size: 15px;
        }
    }

    &__announcement {
        position: absolute;
        overflow: hidden;
        width: 1px;
        height: 1px;
        clip-path: inset(50%);
        white-space: nowrap;
    }

    &__error {
        margin-block-start: -.25em;
        padding-inline: 4px;
        font-size: 15px;
        line-height: 1.5em;
        color: $color-milk-500;
    }

    &__error-prefix {
        font-weight: 500;
        color: var(--input-error-color, #{$color-rose-200});
    }
}
</style>