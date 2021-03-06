/* eslint-disable no-use-before-define */
import moment from 'moment';

import { alerts, assets, dex, neo, network, wallets, ledger } from '../services';
import { timeouts } from '../constants';
import router from '../router';

export {
  addToken,
  claimGas,
  createWallet,
  deleteWallet,
  fetchBlockHeaderByHash,
  fetchCommitState,
  fetchHoldings,
  fetchLatestVersion,
  fetchMarkets,
  fetchOrderHistory,
  fetchRecentTransactions,
  fetchSystemAssetBalances,
  fetchTickerData,
  fetchTradeHistory,
  fetchTradesBucketed,
  findTransactions,
  formOrder,
  importWallet,
  openEncryptedKey,
  openLedger,
  openPrivateKey,
  openSavedWallet,
  pingSocket,
  placeOrder,
  subscribeToMarket,
  unsubscribeFromMarket,
  verifyLedgerConnection,
};

function addToken({ commit, dispatch }, { done, hashOrSymbol }) {
  const networkAssets = assets.getNetworkAssets();
  const userAssets = assets.getUserAssets();
  const currentNetwork = network.getSelectedNetwork();
  let token;

  commit('startRequest', { identifier: 'addToken' });

  hashOrSymbol = hashOrSymbol.replace('0x', '');

  token = _.find(_.values(networkAssets), { symbol: hashOrSymbol });

  if (!token) {
    token = _.get(networkAssets, hashOrSymbol);
  }

  if (!token) {
    /* eslint-disable max-len */
    return commit('failRequest', { identifier: 'addToken', message: `Unable to find a token with the symbol or script hash of '${hashOrSymbol}' on ${currentNetwork.net}` });
    /* eslint-enable max-len */
  }

  if (_.has(userAssets, token.assetId)) {
    /* eslint-disable max-len */
    return commit('failRequest', { identifier: 'addToken', message: `'${hashOrSymbol}' is already in your token list ${currentNetwork.net}` });
    /* eslint-enable max-len */
  }

  assets.addUserAsset(token.assetId);

  dispatch('fetchHoldings', { done });

  return commit('endRequest', { identifier: 'addToken' });
}

function claimGas({ commit }) {
  commit('startRequest', { identifier: 'claimGas' });

  setTimeout(() => {
    neo.claimGas()
      .then(() => {
        commit('endRequest', { identifier: 'claimGas' });
      })
      .catch((message) => {
        alerts.exception(message);
        commit('failRequest', { identifier: 'claimGas', message });
      });
  }, timeouts.NEO_API_CALL);
}

function createWallet({ commit }, { name, passphrase, passphraseConfirm }) {
  commit('startRequest', { identifier: 'createWallet' });

  setTimeout(() => {
    neo
      .createWallet(name, passphrase, passphraseConfirm)
      .then(() => {
        commit('endRequest', { identifier: 'createWallet' });
        commit('setWalletToBackup', wallets.getCurrentWallet());
        router.replace('/authenticated');
      })
      .catch((message) => {
        commit('failRequest', { identifier: 'createWallet', message });
      });
  }, timeouts.NEO_API_CALL);
}

function deleteWallet({ commit }, { name, done }) {
  commit('startRequest', { identifier: 'deleteWallet' });

  setTimeout(() => {
    wallets.remove(name)
      .then(() => {
        wallets.sync();
        done();
        commit('endRequest', { identifier: 'deleteWallet' });
      })
      .catch((e) => {
        alerts.exception(e);
        commit('failRequest', { identifier: 'deleteWallet', message: e });
      });
  }, timeouts.NEO_API_CALL);
}

async function fetchBlockHeaderByHash({ state, commit }, { blockHash, done, failed }) {
  commit('startRequest', { identifier: 'fetchBlockHeaderByHash' });

  // Check if the block is in memory
  let blockHeader = _.get(state.blockDetails, blockHash);

  if (!blockHeader) {
    try {
      blockHeader = await new Promise((resolve, reject) => {
        const rpcClient = network.getRpcClient();
        rpcClient.query({
          method: 'getblockheader',
          params: [blockHash, true],
        })
          .then((res) => {
            resolve(res.result);
          })
          .catch(e => reject(e));
      });
    } catch (e) {
      console.log(e);
      if (failed) {
        failed(e);
        // Don't pass the failure message when failing the request, otherwise it will pop an alert.
        commit('failRequest', { identifier: 'fetchBlockHeaderByHash' });
      }
      return;
    }
    // Make call to get the block
    commit('putBlockDetails', blockHeader);
  }

  if (done) {
    done(blockHeader);
  }
  commit('endRequest', { identifier: 'fetchBlockHeaderByHash' });
}

async function fetchCommitState({ commit }) {
  const currentWallet = wallets.getCurrentWallet();
  let commitState;

  commit('startRequest', { identifier: 'fetchCommitState' });

  try {
    commitState = await dex.fetchCommitState(currentWallet.address);
    commit('setCommitState', commitState);
    commit('endRequest', { identifier: 'fetchCommitState' });
  } catch (message) {
    alerts.networkException(message);
    commit('failRequest', { identifier: 'fetchCommitState', message });
  }
}

async function fetchHoldings({ commit }, { done, isRequestSilent } = {}) {
  const currentWallet = wallets.getCurrentWallet();
  let holdings;

  commit(isRequestSilent ? 'startSilentRequest' : 'startRequest',
    { identifier: 'fetchHoldings' });

  try {
    holdings = await neo.fetchHoldings(currentWallet.address, false);

    commit('setHoldings', holdings.holdings);
    commit('endRequest', { identifier: 'fetchHoldings' });
    commit('setPortfolio', {
      balance: holdings.totalBalance,
      changePercent: holdings.change24hrPercent,
      changeValue: holdings.change24hrValue.toFixed(2),
    });
    if (done) {
      done();
    }
    commit('endRequest', { identifier: 'fetchHoldings' });
  } catch (message) {
    alerts.networkException(message);
    commit('failRequest', { identifier: 'fetchHoldings', message });
  }

  return holdings;
}

function fetchLatestVersion({ commit }) {
  commit('startRequest', { identifier: 'fetchLatestVersion' });

  return axios.get(`${network.getSelectedNetwork().aph}/LatestWalletInfo`)
    .then(({ data }) => {
      network.setExplorer(data.useAphExplorer);
      commit('setLatestVersion', data);
      commit('endRequest', { identifier: 'fetchLatestVersion' });
    })
    .catch((e) => {
      console.log(e);
      commit('failRequest', { identifier: 'fetchLatestVersion', message: e });
    });
}

async function fetchMarkets({ commit, state }) {
  commit('startRequest', { identifier: 'fetchMarkets' });

  try {
    const markets = await dex.fetchMarkets();
    commit('endRequest', { identifier: 'fetchMarkets' });

    commit('setMarkets', markets);
    if (!state.currentMarket) {
      commit('setCurrentMarket', markets[0]);
    }
  } catch (message) {
    alerts.networkException(message);
    commit('failRequest', { identifier: 'fetchMarkets', message });
  }
}

async function fetchOrderHistory({ state, commit }, { isRequestSilent }) {
  const orderHistory = state.orderHistory;
  commit(isRequestSilent ? 'startSilentRequest' : 'startRequest',
    { identifier: 'fetchOrderHistory' });

  try {
    if (orderHistory && orderHistory.length > 0
      && orderHistory[0].updated) {
      const newOrders = await dex.fetchOrderHistory(0, orderHistory[0].updated, 'ASC');
      commit('addToOrderHistory', newOrders);
    } else {
      const orders = await dex.fetchOrderHistory();
      commit('setOrderHistory', orders);
    }

    commit('endRequest', { identifier: 'fetchOrderHistory' });
  } catch (message) {
    alerts.networkException(message);
    commit('failRequest', { identifier: 'fetchOrderHistory', message });
  }
}

async function fetchRecentTransactions({ commit }) {
  const currentWallet = wallets.getCurrentWallet();
  const lastBlockIndex = 0;
  let recentTransactions;

  commit('startRequest', { identifier: 'fetchRecentTransactions' });

  try {
    recentTransactions = await neo.fetchRecentTransactions(currentWallet.address, false, moment().subtract(30, 'days'), null, lastBlockIndex + 1); // eslint-disable-line
    commit('setRecentTransactions', recentTransactions);
    commit('endRequest', { identifier: 'fetchRecentTransactions' });
  } catch (message) {
    alerts.exception(message);
    commit('failRequest', { identifier: 'fetchRecentTransactions', message });
  }
}

async function fetchTickerData({ commit }) {
  commit('startRequest', { identifier: 'fetchTickerData' });

  try {
    const tickerData = await dex.fetchTickerData();
    commit('endRequest', { identifier: 'fetchTickerData' });
    commit('setTickerDataByMarket', tickerData);
  } catch (message) {
    console.log(message);
    commit('failRequest', { identifier: 'fetchTickerData', message });
  }
}

async function fetchTradesBucketed({ commit }, { marketName, interval, from, to }) {
  try {
    commit('startRequest', { identifier: 'fetchTradesBucketed' });

    const apiBuckets = await dex.fetchTradesBucketed(marketName, interval, from, to);

    commit('setTradesBucketed', apiBuckets);
    commit('endRequest', { identifier: 'fetchTradesBucketed' });
  } catch (message) {
    alerts.networkException(message);
    commit('failRequest', { identifier: 'fetchTradesBucketed', message });
  }
}

async function fetchTradeHistory({ commit, state }, { marketName, isRequestSilent }) {
  let history;
  commit(isRequestSilent ? 'startSilentRequest' : 'startRequest',
    { identifier: 'fetchTradeHistory' });

  try {
    const tradeHistoryPromise = dex.fetchTradeHistory(marketName);
    let tradesBucketPromise;

    if (!isRequestSilent) {
      tradesBucketPromise = dex.fetchTradesBucketed(marketName);
    }

    history = await tradeHistoryPromise;

    history.apiBuckets = tradesBucketPromise ?
      await tradesBucketPromise : state.tradeHistory.apiBuckets;

    commit('setTradeHistory', history);
    commit('endRequest', { identifier: 'fetchTradeHistory' });
  } catch (message) {
    alerts.networkException(message);
    commit('failRequest', { identifier: 'fetchTradeHistory', message });
  }
}

async function fetchSystemAssetBalances({ commit }, { forAddress, intents }) {
  commit('startRequest', { identifier: 'fetchSystemAssetBalances' });
  let balances;
  try {
    balances = await neo.fetchSystemAssetBalance(forAddress, intents);
  } catch (message) {
    commit('failRequest', { identifier: 'fetchSystemAssetBalances', message });
    throw message;
  }

  return balances;
}

function findTransactions({ state, commit }) {
  const currentWallet = wallets.getCurrentWallet();

  commit('startRequest', { identifier: 'findTransactions' });

  const fromDate = state.searchTransactionFromDate;
  const toDate = state.searchTransactionToDate ? moment(state.searchTransactionToDate).add(1, 'days') : null;
  neo
    .fetchRecentTransactions(currentWallet.address, true,
      fromDate, toDate)
    .then((data) => {
      commit('setSearchTransactions', data);
      commit('endRequest', { identifier: 'findTransactions' });
    })
    .catch((message) => {
      console.log(message);
      commit('failRequest', { identifier: 'findTransactions', message });
    });
}

async function formOrder({ commit }, { order }) {
  commit('startRequest', { identifier: 'placeOrder' });

  try {
    const res = await dex.formOrder(order);
    commit('setOrderToConfirm', res);
    commit('endRequest', { identifier: 'placeOrder' });
  } catch (message) {
    alerts.exception(message);
    commit('failRequest', { identifier: 'placeOrder', message });
  }
}

function importWallet({ commit }, { name, wif, passphrase, done }) {
  commit('startRequest', { identifier: 'importWallet' });

  setTimeout(() => {
    wallets.importWIF(name, wif, passphrase)
      .then(() => {
        wallets.sync();
        done();
        commit('endRequest', { identifier: 'importWallet' });
      })
      .catch((e) => {
        commit('failRequest', { identifier: 'importWallet', message: e });
      });
  }, timeouts.NEO_API_CALL);
}

function openEncryptedKey({ commit }, { encryptedKey, passphrase, done }) {
  commit('startRequest', { identifier: 'openEncryptedKey' });

  setTimeout(() => {
    wallets.openEncryptedKey(encryptedKey, passphrase)
      .then(() => {
        done();
        commit('endRequest', { identifier: 'openEncryptedKey' });
      })
      .catch((e) => {
        commit('failRequest', { identifier: 'openEncryptedKey', message: e });
      });
  }, timeouts.NEO_API_CALL);
}

function openLedger({ commit }, { done, failed }) {
  commit('startRequest', { identifier: 'openLedger' });

  ledger.close()
    .then(() => {
      ledger.open()
        .then(() => {
          ledger.getPublicKey()
            .then((publicKey) => {
              wallets.openLedger(publicKey)
                .then(() => {
                  done();

                  setTimeout(() => {
                    ledger.close();
                  }, 5 * 1000);

                  commit('endRequest', { identifier: 'openLedger' });
                })
                .catch((e) => {
                  failed(e);
                  commit('failRequest', { identifier: 'openLedger', message: e });
                });
            })
            .catch((e) => {
              failed(e);
              commit('failRequest', { identifier: 'openLedger', message: e });
            });
        })
        .catch((e) => {
          failed(e);
          commit('failRequest', { identifier: 'openLedger', message: e });
        });
    })
    .catch((e) => {
      failed(e);
      commit('failRequest', { identifier: 'openLedger', message: e });
    });
}

function openPrivateKey({ commit }, { wif, done }) {
  commit('startRequest', { identifier: 'openPrivateKey' });

  setTimeout(() => {
    wallets.openWIF(wif)
      .then(() => {
        done();
        commit('endRequest', { identifier: 'openPrivateKey' });
      })
      .catch((e) => {
        commit('failRequest', { identifier: 'openPrivateKey', message: e });
      });
  }, timeouts.NEO_API_CALL);
}

function openSavedWallet({ commit }, { walletToOpen, passphrase, done }) {
  commit('startRequest', { identifier: 'openSavedWallet' });

  setTimeout(() => {
    wallets.openSavedWallet(walletToOpen, passphrase)
      .then(() => {
        done();
        commit('clearActiveTransaction');
        commit('endRequest', { identifier: 'openSavedWallet' });
      })
      .catch((e) => {
        commit('failRequest', { identifier: 'openSavedWallet', message: e });
      });
  }, timeouts.NEO_API_CALL);
}

async function pingSocket({ state, commit }) {
  commit('startRequest', { identifier: 'pingSocket' });

  try {
    if (!state.socket || state.socket.isConnected !== true) {
      return;
    }

    state.socket.client.sendObj({ op: 'ping' });
    commit('endRequest', { identifier: 'pingSocket' });
  } catch (message) {
    alerts.networkException(message);
    commit('failRequest', { identifier: 'pingSocket', message });
  }
}

async function placeOrder({ commit }, { order, done }) {
  commit('startRequest', { identifier: 'placeOrder' });

  try {
    await dex.placeOrder(order);
    done();
    commit('setOrderToConfirm', null);
    commit('endRequest', { identifier: 'placeOrder' });
  } catch (message) {
    alerts.exception(message);
    commit('setOrderToConfirm', null);
    commit('failRequest', { identifier: 'placeOrder', message });
  }
}

async function subscribeToMarket({ state, commit }, { market, isRequestSilent }) {
  if (!market) {
    return;
  }
  commit(isRequestSilent ? 'startSilentRequest' : 'startRequest',
    { identifier: 'subscribeToMarket' });

  try {
    state.socket.client.sendObj({ op: 'subscribe', args: `orderBook:${market.marketName}` });

    const currentWallet = wallets.getCurrentWallet();
    state.socket.client.sendObj({
      op: 'subscribe',
      args: `orderUpdates:${market.marketName}:${currentWallet.address}`,
    });

    commit('endRequest', { identifier: 'subscribeToMarket' });
  } catch (message) {
    alerts.networkException(message);
    commit('failRequest', { identifier: 'subscribeToMarket', message });
  }
}

async function unsubscribeFromMarket({ state, commit }, { market }) {
  if (!market) {
    return;
  }

  commit('startRequest', { identifier: 'unsubscribeFromMarket' });

  try {
    state.socket.client.sendObj({ op: 'unsubscribe', args: `orderBook:${market.marketName}` });

    const currentWallet = wallets.getCurrentWallet();
    state.socket.client.sendObj({
      op: 'unsubscribe',
      args: `orderUpdates:${market.marketName}:${currentWallet.address}`,
    });

    commit('endRequest', { identifier: 'unsubscribeFromMarket' });
  } catch (message) {
    alerts.networkException(message);
    commit('failRequest', { identifier: 'unsubscribeFromMarket', message });
  }
}

function verifyLedgerConnection({ commit }, { done, failed }) {
  commit('startRequest', { identifier: 'verifyLedgerConnection' });

  ledger.open()
    .then(() => {
      done();
      commit('endRequest', { identifier: 'verifyLedgerConnection' });
    })
    .catch((e) => {
      failed(e);
      commit('failRequest', { identifier: 'verifyLedgerConnection', message: e });
    });
}
