import { onBeforeUnmount } from 'vue'

import type {
    Image,
    ImageDimensions,
    ImageErrorMessages
} from '@/types/base64Converter'

const maxImageDimension = 1024
const supportedImageTypes = ['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']

export const useImage = (
    maxImageSize: number,
    errorMessages: ImageErrorMessages,
    isBase64: (text: string) => boolean
) => {
    const pendingImageLoads = new Set<() => void>()
    const pendingImageReads = new Set<() => void>()
    let imageValidationPromise: Promise<string> | undefined
    let imageValidationSource = ''
    let operationId = 0

    const isImageDataUrl = (text: string) => {
        return /^data:image\/(?:avif|gif|jpeg|png|webp);base64,/i.test(text.trim())
    }

    const cancelImageLoads = () => {
        operationId += 1
        pendingImageReads.forEach(cancel => cancel())
        pendingImageLoads.forEach(cancel => cancel())
        imageValidationPromise = undefined
        imageValidationSource = ''
    }

    const getImageHeaderDimensions = (source: string): ImageDimensions => {
        const separator = source.indexOf(',')

        if (separator < 0) {
            throw new Error('Invalid image header.')
        }

        const binary = atob(source.slice(separator + 1))
        const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
        const view = new DataView(bytes.buffer)
        const dimensions: ImageDimensions = { height: 0, width: 0 }
        const declaredType = source.slice(5, source.indexOf(';')).toLowerCase()
        let detectedType = ''

        const requireBytes = (offset: number, length: number, end = bytes.length) => {
            if (offset < 0 || length < 0 || offset + length > end) {
                throw new Error('Invalid image header.')
            }
        }

        const readText = (offset: number, length: number) => {
            requireBytes(offset, length)

            return String.fromCharCode(...bytes.subarray(offset, offset + length))
        }

        const addDimensions = (width: number, height: number) => {
            if (!width || !height) {
                throw new Error('Invalid image header.')
            }

            dimensions.width = Math.max(dimensions.width, width)
            dimensions.height = Math.max(dimensions.height, height)
        }

        const readUint24 = (offset: number) => {
            requireBytes(offset, 3)

            return bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536
        }

        const readWebpChunks = (start: number, end: number, nested = false) => {
            let offset = start

            while (offset < end) {
                requireBytes(offset, 8, end)

                const type = readText(offset, 4)
                const size = view.getUint32(offset + 4, true)
                const data = offset + 8

                requireBytes(data, size, end)

                if (type === 'VP8X') {
                    requireBytes(data, 10, data + size)
                    addDimensions(readUint24(data + 4) + 1, readUint24(data + 7) + 1)
                } else if (type === 'VP8 ') {
                    requireBytes(data, 10, data + size)

                    if (readText(data + 3, 3) !== '\u009d\u0001\u002a') {
                        throw new Error('Invalid image header.')
                    }

                    addDimensions(
                        view.getUint16(data + 6, true) & 16383,
                        view.getUint16(data + 8, true) & 16383
                    )
                } else if (type === 'VP8L') {
                    requireBytes(data, 5, data + size)

                    if (bytes[data] !== 47) {
                        throw new Error('Invalid image header.')
                    }

                    const packed = view.getUint32(data + 1, true)

                    addDimensions((packed & 16383) + 1, ((packed >>> 14) & 16383) + 1)
                } else if (type === 'ANMF') {
                    requireBytes(data, 16, data + size)

                    if (nested) {
                        throw new Error('Invalid image header.')
                    }

                    addDimensions(readUint24(data + 6) + 1, readUint24(data + 9) + 1)
                    readWebpChunks(data + 16, data + size, true)
                }

                offset = data + size + (size % 2)
                requireBytes(offset, 0, end)
            }
        }

        const readAvifBoxes = (start: number, end: number, depth = 0) => {
            let offset = start

            if (depth > 16) {
                throw new Error('Invalid image header.')
            }

            while (offset < end) {
                requireBytes(offset, 8, end)

                let size = view.getUint32(offset)
                const type = readText(offset + 4, 4)
                let headerSize = 8

                if (size === 1) {
                    requireBytes(offset, 16, end)
                    size = view.getUint32(offset + 8) * 4294967296 + view.getUint32(offset + 12)
                    headerSize = 16
                } else if (size === 0) {
                    size = end - offset
                }

                if (!Number.isSafeInteger(size) || size < headerSize) {
                    throw new Error('Invalid image header.')
                }

                requireBytes(offset, size, end)

                const data = offset + headerSize
                const boxEnd = offset + size

                if (type === 'ispe') {
                    requireBytes(data, 12, boxEnd)
                    addDimensions(view.getUint32(data + 4), view.getUint32(data + 8))
                } else if (type === 'av01') {
                    requireBytes(data, 78, boxEnd)
                    addDimensions(view.getUint16(data + 24), view.getUint16(data + 26))
                    readAvifBoxes(data + 78, boxEnd, depth + 1)
                } else if (type === 'meta' || type === 'stsd') {
                    const prefixSize = type === 'meta' ? 4 : 8

                    requireBytes(data, prefixSize, boxEnd)
                    readAvifBoxes(data + prefixSize, boxEnd, depth + 1)
                } else if (['iprp', 'ipco', 'moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) {
                    readAvifBoxes(data, boxEnd, depth + 1)
                }

                offset = boxEnd
            }
        }

        requireBytes(0, 12)

        if (readText(0, 8) === '\u0089PNG\r\n\u001a\n') {
            detectedType = 'image/png'

            requireBytes(0, 33)

            if (view.getUint32(8) !== 13 || readText(12, 4) !== 'IHDR') {
                throw new Error('Invalid image header.')
            }

            addDimensions(view.getUint32(16), view.getUint32(20))
        } else if (['GIF87a', 'GIF89a'].includes(readText(0, 6))) {
            detectedType = 'image/gif'

            requireBytes(0, 13)
            addDimensions(view.getUint16(6, true), view.getUint16(8, true))

            let offset = 13 + (bytes[10] & 128 ? 3 * 2 ** ((bytes[10] & 7) + 1) : 0)

            const skipBlocks = () => {
                while (true) {
                    requireBytes(offset, 1)

                    const size = bytes[offset++]

                    if (size === 0) {
                        return
                    }

                    requireBytes(offset, size)
                    offset += size
                }
            }

            while (offset < bytes.length) {
                const type = bytes[offset++]

                if (type === 59) {
                    break
                }

                if (type === 33) {
                    requireBytes(offset, 1)
                    offset += 1
                    skipBlocks()
                } else if (type === 44) {
                    requireBytes(offset, 9)
                    addDimensions(view.getUint16(offset + 4, true), view.getUint16(offset + 6, true))

                    const packed = bytes[offset + 8]

                    offset += 9 + (packed & 128 ? 3 * 2 ** ((packed & 7) + 1) : 0)
                    requireBytes(offset, 1)
                    offset += 1
                    skipBlocks()
                } else {
                    throw new Error('Invalid image header.')
                }
            }
        } else if (bytes[0] === 255 && bytes[1] === 216) {
            detectedType = 'image/jpeg'

            let offset = 2

            while (offset < bytes.length) {
                requireBytes(offset, 2)

                if (bytes[offset] !== 255) {
                    throw new Error('Invalid image header.')
                }

                while (bytes[offset] === 255) {
                    offset += 1
                }

                requireBytes(offset, 1)

                const marker = bytes[offset++]

                if (marker === 218 || marker === 217) {
                    break
                }

                if (marker === 1 || (marker >= 208 && marker <= 215)) {
                    continue
                }

                requireBytes(offset, 2)

                const size = view.getUint16(offset)

                if (size < 2) {
                    throw new Error('Invalid image header.')
                }

                requireBytes(offset, size)

                if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
                    requireBytes(offset, 8, offset + size)
                    addDimensions(view.getUint16(offset + 5), view.getUint16(offset + 3))
                    break
                }

                offset += size
            }
        } else if (readText(0, 4) === 'RIFF' && readText(8, 4) === 'WEBP') {
            detectedType = 'image/webp'

            const end = view.getUint32(4, true) + 8

            requireBytes(0, end)
            readWebpChunks(12, end)
        } else if (readText(4, 4) === 'ftyp') {
            detectedType = 'image/avif'

            readAvifBoxes(0, bytes.length)
        }

        if (!dimensions.width || !dimensions.height || detectedType !== declaredType) {
            throw new Error('Invalid image header.')
        }

        return dimensions
    }

    const getImageDimensions = (source: string) => {
        const headerDimensions = getImageHeaderDimensions(source)

        if (headerDimensions.width > maxImageDimension || headerDimensions.height > maxImageDimension) {
            throw new Error(errorMessages.imageDimensionsExceeded)
        }

        return new Promise<ImageDimensions>((resolve, reject) => {
            const imageElement = new globalThis.Image()

            const cleanup = () => {
                imageElement.onload = null
                imageElement.onerror = null
                pendingImageLoads.delete(cancel)
            }

            const cancel = () => {
                cleanup()
                imageElement.removeAttribute('src')
                reject(new DOMException('Image loading cancelled.', 'AbortError'))
            }

            imageElement.onload = () => {
                const dimensions = {
                    height: imageElement.naturalHeight,
                    width: imageElement.naturalWidth
                }

                cleanup()

                if (dimensions.width > maxImageDimension || dimensions.height > maxImageDimension) {
                    reject(new Error(errorMessages.imageDimensionsExceeded))
                    return
                }

                resolve(dimensions)
            }

            imageElement.onerror = (event) => {
                cleanup()
                reject(event)
            }

            pendingImageLoads.add(cancel)
            imageElement.src = source
        })
    }

    const validateImageSource = async (source: string) => {
        const separator = source.indexOf(',')
        const payload = source.slice(separator + 1).replace(/\s/g, '')

        const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0

        if (payload.length * 3 / 4 - padding > maxImageSize) {
            throw new Error(errorMessages.imageSizeExceeded)
        }

        if (!isBase64(payload)) {
            throw new Error(errorMessages.invalidBase64Image)
        }

        const imageSource = `${source.slice(0, separator).toLowerCase()},${payload}`
        await getImageDimensions(imageSource)

        return imageSource
    }

    const getValidatedImageSource = (source: string) => {
        if (source !== imageValidationSource || !imageValidationPromise) {
            imageValidationSource = source
            imageValidationPromise = validateImageSource(source)
        }

        return imageValidationPromise
    }

    const readImage = (file: File) => {
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader()

            const cleanup = () => {
                reader.onload = null
                reader.onerror = null
                reader.onabort = null
                pendingImageReads.delete(cancel)
            }

            const cancel = () => {
                cleanup()
                reader.abort()
                reject(new DOMException('Image reading cancelled.', 'AbortError'))
            }

            reader.onload = () => {
                const source = String(reader.result)

                cleanup()
                resolve(source)
            }

            reader.onerror = () => {
                const cause = reader.error

                cleanup()
                reject(cause)
            }

            reader.onabort = () => {
                cleanup()
                reject(new DOMException('Image reading cancelled.', 'AbortError'))
            }

            pendingImageReads.add(cancel)

            try {
                reader.readAsDataURL(file)
            } catch (cause) {
                cleanup()
                reject(cause)
            }
        })
    }

    const readImageFile = async (file: File): Promise<Image> => {
        const currentOperationId = operationId

        if (!supportedImageTypes.includes(file.type)) {
            throw new Error(errorMessages.unsupportedImageType)
        }

        if (file.size > maxImageSize) {
            throw new Error(errorMessages.imageSizeExceeded)
        }

        const source = await readImage(file)

        if (currentOperationId !== operationId) {
            throw new DOMException('Image reading cancelled.', 'AbortError')
        }

        const dimensions = await getImageDimensions(source)

        if (currentOperationId !== operationId) {
            throw new DOMException('Image loading cancelled.', 'AbortError')
        }

        return {
            height: dimensions.height,
            name: file.name,
            size: file.size,
            source,
            width: dimensions.width
        }
    }

    onBeforeUnmount(cancelImageLoads)

    return {
        cancelImageLoads,
        getValidatedImageSource,
        isImageDataUrl,
        readImageFile
    }
}