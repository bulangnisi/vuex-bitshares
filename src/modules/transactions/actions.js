import { ChainTypes } from 'bitsharesjs';
import { types } from './mutations';
import API from '../../services/api';

const btsMarket = API.Market['1.3.0'];

const actions = {
  fetchComissions: async ({ commit }) => {
    const { fees } = await API.Parameters.getComissions();
    const operations = Object.keys(ChainTypes.operations);
    const orderIdx = operations.indexOf('limit_order_create');
    const transferIdx = operations.indexOf('transfer');

    const { fee: orderFee } = fees[orderIdx][1];
    const { fee: transeferFee, price_per_kbyte: kbytePrice } = fees[transferIdx][1];

    const comissions = {
      order: {
        fee: orderFee
      },
      transfer: {
        fee: transeferFee,
        kbytePrice
      }
    };
    commit(types.FETCH_FEES, { fees: comissions });
  },

  createOrdersFromDistribution: async (store) => {
    const { commit, rootGetters, getters } = store;
    if (getters.areTransactionsProcessing) return;
    const distribution = getters.getPendingDistribution;
    if (!distribution) return;
    const userId = rootGetters['account/getAccountUserId'];
    const balances = rootGetters['account/getCurrentUserBalances'];
    const getMarketPriceById = rootGetters['market/getPriceById'];

    const defaultAssetsIds = rootGetters['assets/getDefaultAssetsIds'];

    const combinedBalances = JSON.parse(JSON.stringify(balances));
    defaultAssetsIds.forEach(id => {
      if (combinedBalances[id]) return;
      combinedBalances[id] = { balance: 0 };
    });

    Object.keys(combinedBalances).forEach(id => {
      combinedBalances[id] = combinedBalances[id].balance;
    });

    const assetsIds = Object.keys(combinedBalances);
    const baseBalances = {};

    assetsIds.forEach(id => {
      baseBalances[id] = combinedBalances[id] * getMarketPriceById(id);
    });


    const orders = btsMarket.generateOrders({
      userId,
      update: distribution,
      balances: combinedBalances,
      baseBalances
    });
    console.log(orders);

    // if sell finished, only update buy orders

    commit(types.UPDATE_PENDING_ORDERS, { orders });
  },

  setPendingDistribution: (store, { distribution }) => {
    const { commit } = store;
    commit(types.SET_PENDING_DISTRIBUTION, { distribution });
    this.createOrdersFromDistribution(store);
  },

  removePendingDistribution: (store) => {
    const { commit } = store;
    commit(types.REMOVE_PENDING_DISTRIBUTION);
  },


  handleOrdersError: (store) => {
    const { commit } = store;
    commit(types.PROCESS_PENDING_ORDERS_ERROR);
    this.createOrdersFromDistribution(store);
  },


  processPendingOrders: async (store) => {
    const { getters, commit, rootGetters } = store;
    commit(types.PROCESS_PENDING_ORDERS_REQUEST);
    const keys = rootGetters['account/getKeys'];
    if (!keys) {
      this.handleOrdersError(store);
      return {
        success: false,
        error: 'Account is locked'
      };
    }
    const pendingOrders = getters.getPendingOrders;
    if (pendingOrders.sellOrders.length) {
      const sellResult = await API.Transactions.placeOrders({
        orders: pendingOrders.sellOrders,
        keys });
      if (!sellResult.success) {
        this.handleOrdersError(store);
        return {
          success: false,
          error: sellResult.error
        };
      }
      commit(types.PROCESS_PENDING_ORDERS_SELL_COMPLETE);
    }
    if (pendingOrders.buyOrders.length) {
      const buyResult = await API.Transactions.placeOrders({
        orders: pendingOrders.buyOrders,
        keys
      });
      console.log(buyResult);
      if (!buyResult.success) {
        this.handleOrdersError(store);
        return {
          success: false,
          error: buyResult.error
        };
      }
    }
    commit(types.PROCESS_PENDING_ORDERS_COMPLETE);
    console.log('TADAM');
    return {
      success: true
    };
  },

  resetPendingOrders: (store) => {
    const { commit } = store;
    commit(types.RESET_PENDING_ORDERS);
  },


  transferAsset: async ({ commit, rootGetters }, { to, assetId, amount, memo }) => {
    commit(types.TRANSFER_ASSET_REQUEST);
    const fromId = rootGetters['acc/getAccountUserId'];
    const keys = rootGetters['acc/getKeys'];

    if (!keys) {
      commit(types.TRANSFER_ASSET_ERROR, 'Wallet locked');
      return {
        success: false,
        error: 'Wallet is locked'
      };
    }
    const res = await API.Transactions.transferAsset(fromId, to, assetId, amount, keys, memo);
    if (res.success) {
      commit(types.TRANSFER_ASSET_COMPLETE);
      return {
        success: true
      };
    }
    commit(types.TRANSFER_ASSET_ERROR, res.error);
    return {
      success: false,
      error: res.error
    };
  },

  setPendingTransfer: ({ commit }, { transaction }) => {
    commit(types.SET_PENDING_TRANSFER, { transaction });
  },

  clearPendingTransfer: ({ commit }) => {
    commit(types.CLEAR_PENDING_TRANSFER);
  },

  cancelOrder: async ({ commit, rootGetters }, { orderId }) => {
    commit(types.PROCESS_CANCEL_ORDER_REQUEST, orderId);
    const userId = rootGetters['acc/getAccountUserId'];
    const keys = rootGetters['acc/getKeys'];
    if (!keys) {
      commit(types.PROCESS_CANCEL_ORDER_ERROR);
      return {
        success: false,
        error: 'Wallet is locked'
      };
    }
    const res = await API.Transactions.cancelOrder({ orderId, userId, keys });
    if (res.success) {
      commit(types.PROCESS_CANCEL_ORDER_COMPLETE);
      return { success: true };
    }

    commit(types.PROCESS_CANCEL_ORDER_ERROR);
    const error = res.error ? res.error : 'Something went wrong';
    return {
      success: false,
      error
    };
  },
};

export default actions;
