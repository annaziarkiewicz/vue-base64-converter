export type ContentType = 'BASE64' | 'IMAGE' | 'TEXT'

export type FieldHistoryState = {
    direction: 'forward' | 'backward' | 'none'
    end: number
    start: number
    value: string
}

export type Image = {
    height: number
    name: string
    size: number
    source: string
    width: number
}

export type ImageDimensions = {
    height: number
    width: number
}

export type ImageErrorMessages = {
    imageDimensionsExceeded: string
    imageSizeExceeded: string
    invalidBase64Image: string
    unsupportedImageType: string
}
