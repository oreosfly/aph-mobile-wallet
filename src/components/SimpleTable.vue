<template>
  <section class="aph-simple-table">
    <table class="table-wrapper">
      <thead v-if="hasHeader">
        <tr class="table-header-row">
          <th v-for="key in columns"
            @click="sortBy(key)"
            class="header-cell"
            :class="{ active: sortKey === key }">
            {{ key }}
            <span class="arrow" :class="sortOrders[key] > 0 ? 'asc' : 'dsc'"></span>
          </th>
        </tr>
      </thead>
      <tbody class="table-body-wrapper" v-if="data.length > 0">
        <tr :class="['row', injectRowStyling(entry)]" v-for="entry in filteredData" @click="handleRowClick(entry)">
          <td class="cell" :class="[key, injectCellStyling(entry[key], entry, key)]" v-for="key in columns"
            @click="handleCellClick(entry, key)">
            <slot :name=key :value=entry[key]>
              {{ formatEntry !== null ? formatEntry(entry[key], entry, key) : entry[key] }}
            </slot>
          </td>
        </tr>
      </tbody>
      <div class="error-message" v-else-if="data.length < 1">
        There's no data here.
      </div>
    </table>
  </section>
</template>

<script>

export default {
  props: {
    columns: {
      default: [],
      type: Array,
    },
    data: {
      default: [],
      type: Array,
    },
    filterKey: {
      default: '',
      type: String,
    },
    formatEntry: {
      default: null,
      type: Function,
    },
    handleCellClick: {
      default: () => {},
      type: Function,
    },
    handleRowClick: {
      default: () => {},
      type: Function,
    },
    hasHeader: {
      default: true,
      type: Boolean,
    },
    injectCellStyling: {
      default: () => {},
      type: Function,
    },
    injectRowStyling: {
      default: () => {},
      type: Function,
    },
  },

  data() {
    const sortOrders = {};
    this.columns.forEach((key) => {
      sortOrders[key] = 1;
    });

    return {
      sortKey: '',
      sortOrders,
    };
  },

  computed: {
    filteredData() {
      const sortKey = this.sortKey;
      const filterKey = this.filterKey && this.filterKey.toLowerCase();
      const order = this.sortOrders[sortKey] || 1;
      let data = this.data;
      if (filterKey) {
        data = data.filter((row) => {
          return Object.keys(row).some((key) => {
            return String(row[key]).toLowerCase().indexOf(filterKey) > -1;
          });
        });
      }
      if (sortKey) {
        data = data.sort((aVal, bVal) => {
          aVal = aVal[sortKey];
          bVal = bVal[sortKey];
          if (aVal === bVal) {
            return 0 * order;
          } else if (aVal > bVal) {
            return 1 * order;
          }
          return -1 * order;
        });
      }
      return data;
    },
  },

  methods: {
    sortBy(key) {
      this.sortKey = key;
      this.sortOrders[key] = this.sortOrders[key] * -1;
    },
  },
};

</script>

<style lang="scss">
.aph-simple-table {
  display: flex;
  flex: 1;
  font-family: Gilroy;

  .table-wrapper {
    border-radius: $border-radius;
    display: flex;
    flex-direction: column;
    flex: 1;

    .table-header-row {
      @extend %small-uppercase-grey-label-dark;

      display: flex;
      flex-direction: row;
      flex: none;
      font-size: toRem(10px);
      padding: $space-sm 0;

      .header-cell {
        display: flex;
        flex-basis: auto;
        margin: 0;
        padding: 0;
        user-select: none;
        white-space: nowrap;
        width: 100%;

        &:last-child {
          justify-content: flex-end;
        }

        .arrow {
          display: none;
          height: 0;
          margin-left: $space-xs;
          margin: auto 0 auto toRem(2px);
          width: 0;
        }
      }

      .header-cell .arrow.asc {
        border-bottom: 4px solid $dark-grey;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
      }

      .header-cell .arrow.dsc {
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-top: 4px solid $dark-grey;
      }

      .header-cell.active .arrow {
        display: inline-block;
      }
    }

    .error-message {
      text-align: center;
      color: $darker-grey;
    }

    .table-body-wrapper {
      display: block;
      overflow: auto;

      .row {
        display: flex;

        &:active {
          background: $darker-grey/2;

          .cell {
            border-top: 1px solid transparent;
          }
        }

        &:active + tr {
          .cell {
            border-top: 1px solid transparent;
          }
        }

        .cell {
          border-top: 1px solid $darker-grey/2;
          display: flex;
          flex: 1;
          font-size: toRem(12px);
          padding: $space-sm 0;

          &:first-child {
            padding-left: $space-sm;
          }

          &:last-child {
            justify-content: flex-end;
            padding-right: $space-sm;
          }
        }
      }
    }
  }
}
</style>
