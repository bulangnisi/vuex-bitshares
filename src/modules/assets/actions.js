import { types } from './mutations';
import API from '../../services/api';
import { arrayToObject } from '../../utils';
import config from '../../../config';

const actions = {
  hideAsset: async ({ commit }, assetId) => {
    commit(types.HIDE_ASSET, assetId);
  },

  showAsset: async ({ commit }, assetId) => {
    commit(types.SHOW_ASSET, assetId);
  },

  /**
   * Fetches default assets objects via fetchAssets function
   to save default assets ids
   */
  fetchAssets: async (store, { assets }) => {
    const { commit, getters } = store;
    const currentAssetsIds = Object.keys(getters.getAssets);

    // filter out existing assets
    const filteredAssets = assets.filter(id => currentAssetsIds.indexOf(id) === -1);

    commit(types.FETCH_ASSETS_REQUEST);
    const result = await API.Assets.fetch(filteredAssets);

    if (result) {
      console.log(result)
      // to remove prefix specified in config (e.x. ".OPEN")
      const prefix = config.removePrefix;
      if (prefix) {
        result.forEach(asset => {
          if (asset.symbol.substring(0, prefix.length) === prefix) {
            asset.symbol = asset.symbol.slice(prefix.length);
          }
        });
      }

      const composedResult = arrayToObject(result);

      commit(types.FETCH_ASSETS_COMPLETE, { assets: composedResult });
      return composedResult;
    }
    commit(types.FETCH_ASSETS_ERROR);
    return null;
  }
};

actions.fetchDefaultAssets = async (store) => {
  const { commit } = store;
  const { defaultAssetsNames, defaultMarkets } = config;
  const marketInfoAssets = Object.keys(defaultMarkets).reduce((result, base) => {
    return [...new Set([...defaultMarkets[base], ...result])] 
  }, [])

  const defaultAssets = [...new Set([...marketInfoAssets, ...defaultAssetsNames])]

  console.log(defaultAssets)

  const assets = await actions.fetchAssets(store, { assets: defaultAssets });
  if (assets) {
    const ids = Object.keys(assets);
    commit(types.SAVE_DEFAULT_ASSETS_IDS, { ids });
  }
};

export default actions;
