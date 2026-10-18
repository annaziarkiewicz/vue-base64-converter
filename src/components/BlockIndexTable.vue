<template>
    <section class="az-base64-index">
        <h2 class="az-base64-index__title">
            Base64 index table
        </h2>

        <table
            class="az-base64-index__table"
            role="table"
        >
            <caption class="az-base64-index__caption">
                Base64 characters and their index values
            </caption>

            <thead role="rowgroup">
                <tr role="row">
                    <th
                        v-for="group in 4"
                        :key="group"
                        role="columnheader"
                        scope="col"
                    >
                        Index and character
                    </th>
                </tr>
            </thead>

            <tbody role="rowgroup">
                <tr
                    v-for="row in rows"
                    :key="row[0].index"
                    class="az-base64-index__row"
                    role="row"
                >
                    <td
                        v-for="item in row"
                        :key="item.index"
                        class="az-base64-index__item"
                        role="cell"
                    >
                        <span class="az-base64-index__number">
                            {{ item.index }}
                        </span>

                        <span class="az-base64-index__character">
                            {{ item.character }}
                        </span>
                    </td>
                </tr>
            </tbody>
        </table>
    </section>
</template>

<script lang="ts" setup>
const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const rows = Array.from({ length: 16 }, (_, rowIndex) => {
    return [0, 16, 32, 48].map((offset) => {
        const index = rowIndex + offset

        return {
            character: base64Alphabet[index],
            index
        }
    })
})
</script>

<style lang="scss" scoped>
.az-base64-index {
    width: 100%;
    padding: 36px;
    display: flex;
    flex-direction: column;

    &__title {
        margin-block-end: 16px;
        font-size: 24px;
        line-height: 1.3333em;
        color: $color-milk-100;
        text-transform: uppercase;
        overflow-wrap: anywhere;

        @media (max-width: 360px) {
            line-height: 1.8333em;
        }

        @media (max-width: 330px) {
            line-height: 1.25em;
        }

        &:before {
            content: '';
            width: 38px;
            height: 38px;
            float: right;

            @media (max-width: 360px) {
                width: 44px;
                height: 44px;
            }
        }
    }

    &__caption,
    thead {
        position: absolute;
        overflow: hidden;
        width: 1px;
        height: 1px;
        clip-path: inset(50%);
    }

    &__table {
        width: 100%;
        display: flex;
        flex-direction: column;
        border-spacing: 0;
        font-size: 20px;
        line-height: 1.5em;
        color: $color-milk-100;
    }

    tbody {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    &__row {
        display: grid;
        grid-template-columns: repeat(4, 52px);
        justify-content: space-between;
    }

    &__item {
        width: 52px;
        min-width: 0;
        padding: 0;
        display: flex;
        align-items: flex-start;
    }

    &__number {
        width: 32px;
        flex-shrink: 0;
        color: #CFCFC9;
    }

    &__character {
        min-width: 0;
        flex: 1;
        overflow-wrap: anywhere;
    }

    @media (max-width: 360px) {
        padding: 24px;
    }
}

:global(.az-modal:has(.az-converter__index-table) .az-modal__content) {
    width: 100%;
    max-width: 400px;
}

:global(.az-modal:has(.az-converter__index-table) .az-modal__close) {
    top: 30px;
    right: 30px;

    @media (max-width: 360px) {
        top: 24px;
        right: 24px;
    }
}
</style>