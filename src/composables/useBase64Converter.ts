import {
    computed,
    onBeforeUnmount,
    ref,
    watch
} from 'vue'

import { useImage } from '@/composables/useImage'

import type {
    ContentType,
    Image
} from '@/types/base64Converter'

const maxContentSize = 2 * 1024 * 1024
const maxBase64Length = Math.ceil(maxContentSize / 3) * 4
const contentSizeLabel = `${maxContentSize / (1024 * 1024)} MiB`

export const errorMessages = {
    emptyBase64: 'Enter Base64 data.',
    emptyContent: 'Enter text or select an image.',
    imageDimensionsExceeded: 'Use an image up to 1024 x 1024 px.',
    imageReadFailed: 'Invalid image.',
    imageSizeExceeded: `Use an image up to ${contentSizeLabel}.`,
    textSizeExceeded: `Use text up to ${contentSizeLabel} in UTF-8.`,
    base64SizeExceeded: `Use Base64 representing up to ${contentSizeLabel} of data.`,
    invalidBase64Image: 'Invalid Base64 image.',
    invalidBase64Text: 'Invalid Base64 text.',
    unsupportedImageType: 'Use PNG, JPG, JPEG, WEBP, GIF or AVIF.'
}

export const useBase64Converter = () => {
    const error = ref('')
    const image = ref<Image | null>(null)
    const imageResult = ref('')
    const result = ref('')
    const resultSource = ref('')
    const value = ref('')
    const validatedImageValue = ref('')
    const validatedTextValue = ref('')
    let decodedTextSource = ''
    let decodedTextValue = ''
    let textValidationTimeout: ReturnType<typeof setTimeout> | undefined
    let operationId = 0
    let validationId = 0

    const hasImage = computed(() => image.value !== null)
    const hasResult = computed(() => Boolean(result.value || imageResult.value))

    const isBase64 = (text: string) => {
        const source = text.trim()

        const normalized = source.replace(/\s/g, '')

        if (
            normalized.length < 4
            || normalized.length % 4 !== 0
            || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)
        ) {
            return false
        }

        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
        const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
        const lastIndex = alphabet.indexOf(normalized[normalized.length - padding - 1])

        return padding === 0 || (lastIndex & (padding === 2 ? 15 : 3)) === 0
    }

    const {
        cancelImageLoads,
        getValidatedImageSource,
        isImageDataUrl,
        readImageFile
    } = useImage(maxContentSize, errorMessages, isBase64)

    const isImageBase64Input = computed(() => isImageDataUrl(value.value))

    const contentType = computed<ContentType | null>(() => {
        if (image.value) {
            return 'IMAGE'
        }

        if (!value.value) {
            return null
        }

        const source = value.value.trim()

        if (isImageDataUrl(source)) {
            return validatedImageValue.value === source ? 'BASE64' : 'TEXT'
        }

        return validatedTextValue.value === source ? 'BASE64' : 'TEXT'
    })

    const clearOutput = () => {
        error.value = ''
        imageResult.value = ''
        result.value = ''
        resultSource.value = ''
    }

    const clearAll = () => {
        operationId += 1
        cancelImageLoads()
        clearOutput()
        image.value = null
        value.value = ''
    }

    const clearImage = () => {
        operationId += 1
        cancelImageLoads()
        image.value = null
        clearOutput()
    }

    const encodeText = (text: string) => {
        const bytes = new TextEncoder().encode(text)
        let binary = ''

        bytes.forEach((byte) => {
            binary += String.fromCharCode(byte)
        })

        return btoa(binary)
    }

    const decodeText = (base64: string) => {
        const normalized = base64.replace(/\s/g, '')

        if (normalized.length > maxBase64Length) {
            throw new Error(errorMessages.base64SizeExceeded)
        }

        if (!isBase64(normalized)) {
            throw new Error(errorMessages.invalidBase64Text)
        }

        const binary = atob(normalized)

        if (binary.length > maxContentSize) {
            throw new Error(errorMessages.base64SizeExceeded)
        }

        const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))

        return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
    }

    const getDecodedText = (source: string) => {
        if (source !== decodedTextSource) {
            const text = decodeText(source.replace(/\s/g, ''))

            decodedTextSource = source
            decodedTextValue = text
        }

        return decodedTextValue
    }

    const convertToBase64 = () => {
        operationId += 1
        cancelImageLoads()
        clearOutput()

        if (!value.value) {
            error.value = errorMessages.emptyContent
            return
        }

        if (value.value.length > maxContentSize
            || new TextEncoder().encode(value.value).byteLength > maxContentSize) {
            error.value = errorMessages.textSizeExceeded
            return
        }

        result.value = encodeText(value.value)
        resultSource.value = value.value
    }

    const decodeFromBase64 = async () => {
        clearOutput()

        const currentOperationId = ++operationId

        const source = value.value.trim()

        if (!source) {
            error.value = errorMessages.emptyBase64
            return
        }

        if (isImageDataUrl(source)) {
            try {
                const imageSource = await getValidatedImageSource(source)

                if (currentOperationId !== operationId) {
                    return
                }

                validatedImageValue.value = source
                result.value = imageSource
                imageResult.value = imageSource
                resultSource.value = value.value
            } catch (cause) {
                if (currentOperationId === operationId) {
                    validatedImageValue.value = ''
                    error.value = cause instanceof Error
                        && (cause.message === errorMessages.imageSizeExceeded
                            || cause.message === errorMessages.imageDimensionsExceeded)
                        ? cause.message
                        : errorMessages.invalidBase64Image
                }
            }

            return
        }

        try {
            result.value = getDecodedText(source)
            resultSource.value = value.value
        } catch (cause) {
            error.value = cause instanceof Error && cause.message === errorMessages.base64SizeExceeded
                ? cause.message
                : errorMessages.invalidBase64Text
        }
    }

    const selectImage = async (file?: File) => {
        const currentOperationId = ++operationId

        if (!file) {
            return
        }

        cancelImageLoads()
        clearOutput()

        try {
            const selectedImage = await readImageFile(file)

            if (currentOperationId !== operationId) {
                return
            }

            value.value = ''
            image.value = selectedImage
            result.value = selectedImage.source
            resultSource.value = selectedImage.source
        } catch (cause) {
            if (currentOperationId === operationId) {
                error.value = cause instanceof Error
                    && (cause.message === errorMessages.imageDimensionsExceeded
                        || cause.message === errorMessages.imageSizeExceeded
                        || cause.message === errorMessages.unsupportedImageType)
                    ? cause.message
                    : errorMessages.imageReadFailed
            }
        }
    }

    watch(value, (currentValue) => {
        operationId += 1
        error.value = ''
        validatedImageValue.value = ''
        validatedTextValue.value = ''
        clearTimeout(textValidationTimeout)
        cancelImageLoads()

        const source = currentValue.trim()
        const currentValidationId = ++validationId

        if (isImageDataUrl(source)) {
            getValidatedImageSource(source).then(() => {
                if (currentValidationId === validationId) {
                    validatedImageValue.value = source
                }
            }).catch(() => {
                if (currentValidationId === validationId) {
                    validatedImageValue.value = ''
                }
            })
        }

        if (source && !isImageDataUrl(source)
            && source.replace(/\s/g, '').length <= maxBase64Length) {
            textValidationTimeout = setTimeout(() => {
                try {
                    getDecodedText(source)

                    if (currentValidationId === validationId) {
                        validatedTextValue.value = source
                    }
                } catch {
                    if (currentValidationId === validationId) {
                        validatedTextValue.value = ''
                    }
                }
            }, 150)
        } else {
            decodedTextSource = ''
            decodedTextValue = ''
        }

        if (!resultSource.value || currentValue === resultSource.value) {
            return
        }

        clearOutput()
    }, { flush: 'sync' })

    onBeforeUnmount(() => {
        clearTimeout(textValidationTimeout)
        operationId += 1
        validationId += 1
    })

    return {
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
    }
}