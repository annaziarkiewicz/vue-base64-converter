import type { FieldHistoryState } from '@/types/base64Converter'

const maxHistoryStates = 24
const maxHistorySize = 16 * 1024 * 1024

export const useFieldHistory = () => {
    const undoStates: FieldHistoryState[] = []
    const redoStates: FieldHistoryState[] = []
    let historySize = 0

    const getStateSize = (state: FieldHistoryState) => state.value.length * 2

    const removeState = (states: FieldHistoryState[], oldest = false) => {
        const state = oldest ? states.shift() : states.pop()

        if (state) {
            historySize -= getStateSize(state)
        }

        return state
    }

    const addState = (states: FieldHistoryState[], state: FieldHistoryState) => {
        states.push({ ...state })
        historySize += getStateSize(state)
    }

    const trimHistory = (activeStates: FieldHistoryState[]) => {
        const otherStates = activeStates === undoStates ? redoStates : undoStates

        while (undoStates.length + redoStates.length > maxHistoryStates
            || historySize > maxHistorySize) {
            removeState(otherStates.length ? otherStates : activeStates, true)
        }
    }

    const hasFieldHistory = (redo = false) => Boolean((redo ? redoStates : undoStates).length)

    const clearFieldHistory = () => {
        undoStates.length = 0
        redoStates.splice(0)
        historySize = 0
    }

    const getFieldHistoryState = (field: HTMLInputElement | HTMLTextAreaElement): FieldHistoryState => {
        return {
            direction: field.selectionDirection ?? 'none',
            end: field.selectionEnd ?? field.value.length,
            start: field.selectionStart ?? field.value.length,
            value: field.value
        }
    }

    const recordFieldHistory = (state: FieldHistoryState) => {
        redoStates.forEach((redoState) => {
            historySize -= getStateSize(redoState)
        })
        redoStates.splice(0)
        addState(undoStates, state)
        trimHistory(undoStates)
    }

    const restoreFieldHistory = (currentState: FieldHistoryState, redo = false) => {
        const sourceStates = redo ? redoStates : undoStates
        const targetStates = redo ? undoStates : redoStates
        const state = removeState(sourceStates)

        if (!state) {
            return undefined
        }

        addState(targetStates, currentState)
        trimHistory(targetStates)

        return state
    }

    const synchronizeFieldHistory = (
        previousState: FieldHistoryState | undefined,
        currentState: FieldHistoryState,
        redo = false
    ) => {
        if (previousState?.value === currentState.value) {
            return
        }

        const sourceStates = redo ? redoStates : undoStates
        const targetStates = redo ? undoStates : redoStates
        let matchingIndex = sourceStates.length - 1

        while (matchingIndex >= 0 && sourceStates[matchingIndex].value !== currentState.value) {
            matchingIndex -= 1
        }

        if (!previousState || matchingIndex < 0) {
            clearFieldHistory()

            if (previousState) {
                addState(targetStates, previousState)
                trimHistory(targetStates)
            }

            return
        }

        let state = previousState

        while (sourceStates.length > matchingIndex) {
            addState(targetStates, state)
            state = removeState(sourceStates) as FieldHistoryState
        }

        trimHistory(targetStates)
    }

    return {
        clearFieldHistory,
        getFieldHistoryState,
        hasFieldHistory,
        recordFieldHistory,
        restoreFieldHistory,
        synchronizeFieldHistory
    }
}