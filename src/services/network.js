import _ from 'lodash';
import { rpc, settings, api } from '@cityofzion/neon-js';

import { store } from '../store';
import storage from './storage';
import { intervals } from '../constants';
import tokens from './tokens';
import assets from './assets';

const NETWORK_STORAGE_KEY = 'aph.network';
const NETWORKS = [
  {
    label: 'MainNet',
    value: {
      aph: 'https://mainnet.aphelion-neo.com:62443/api',
      net: 'MainNet',
      rpc: 'https://mainneo.aphelion-neo.com:10331',
    },
  },
  {
    label: 'TestNet',
    value: {
      aph: 'https://testnet.aphelion-neo.com:62443/api',
      net: 'TestNet',
      rpc: 'https://testneo.aphelion-neo.com:20331',
    },
  },
];

let loadNetworkStatusIntervalId;

export default {
  getNetworks() {
    return _.sortBy(NETWORKS, 'label');
  },

  getRpcClient() {
    return rpc.default.create.rpcClient(this.getSelectedNetwork().rpc);
  },

  getSelectedNetwork() {
    return storage.get(NETWORK_STORAGE_KEY, _.first(NETWORKS).value);
  },

  init() {
    this.setSelectedNetwork(this.getSelectedNetwork());
  },

  setExplorer(useAphExplorer) {
    // freeze to neoscan for any calls that neon-js uses to switch.loadBalance
    api.setApiSwitch(0);
    api.setSwitchFreeze(true);

    settings.timeout.rpc = 20000;
    if (useAphExplorer === true) {
      settings.networks.MainNet.extra.neoscan = 'https://explorer.aphelion-neo.com:4443/api/main_net';
      settings.networks.TestNet.extra.neoscan = 'https://test-explorer.aphelion-neo.com:4443/api/test_net';
    } else {
      settings.networks.MainNet.extra.neoscan = 'https://api.neoscan.io/api/main_net';
      settings.networks.TestNet.extra.neoscan = 'https://neoscan-testnet.io/api/test_net';
    }
  },

  loadStatus() {
    const network = this.getSelectedNetwork();
    const rpcClient = this.getRpcClient();

    rpcClient.getBestBlockHash()
      .then((blockHash) => {
        if (network.bestBlock && network.bestBlock.hash === blockHash) {
          // Don't redundantly fetch the block we already fetched.
          return;
        }

        store.dispatch('fetchBlockHeaderByHash', { blockHash,
          done: ((data) => {
            store.commit('setLastReceivedBlock');
            store.commit('setLastSuccessfulRequest');
            this.normalizeAndStore(_.set(network, 'bestBlock', data)).sync();
          }),
          failed: ((ex) => {
            console.log(ex);
          }) });
      })
      .catch((e) => {
        console.log(e);
      });
  },

  normalizeAndStore(network) {
    storage.set(NETWORK_STORAGE_KEY, network);

    return this;
  },

  setSelectedNetwork(network) {
    this.normalizeAndStore(network).sync();

    tokens.migrateToAssets(network);

    if (loadNetworkStatusIntervalId) {
      clearInterval(loadNetworkStatusIntervalId);
    }

    this.setExplorer(false);

    this.loadStatus();
    loadNetworkStatusIntervalId = setInterval(() => {
      this.loadStatus();
    }, intervals.NETWORK_STATUS);

    return this;
  },

  sync() {
    store.commit('setCurrentNetwork', this.getSelectedNetwork());
  },

};
