import { Apis } from 'bitsharesjs-ws';

const precisedCount = (cnt, prec) => cnt / (10 ** prec);

// It returns open and close prices for given bucket with base and quote precisions
const getPricesFromBucket = (basePrecision, quotePrecision, bucket) => {
  const closeCountBase = precisedCount(bucket.close_base, basePrecision);
  const closeCountQuote = precisedCount(bucket.close_quote, quotePrecision);
  const openCountBase = precisedCount(bucket.open_base, basePrecision);
  const openCountQuote = precisedCount(bucket.open_quote, quotePrecision);
  return {
    open: openCountBase / openCountQuote,
    close: closeCountBase / closeCountQuote
  };
};

const getUsdPrices = (basePrecision, usdPrecision, usdFirstBucket, usdLastBucket) => {
  const { open: usdOpenPrice } = getPricesFromBucket(basePrecision, usdPrecision, usdFirstBucket);
  const { close: usdClosePrice } = getPricesFromBucket(basePrecision, usdPrecision, usdLastBucket);
  const medianPrice = (usdOpenPrice + usdClosePrice) / 2;
  return {
    last: usdClosePrice,
    median: medianPrice
  };
};

const dailyStatsInHourBuckets = (base, quote) => {
  const bucketSize = 3600;
  const endDate = new Date();
  const startDate = new Date(endDate - (1000 * 60 * 60 * 24));
  const endDateISO = endDate.toISOString().slice(0, -5);
  const startDateISO = startDate.toISOString().slice(0, -5);
  return Apis.instance().history_api().exec(
    'get_market_history',
    [base.id, quote.id, bucketSize, startDateISO, endDateISO]
  ).then((result) => {
    return {
      asset: quote,
      data: result
    };
  });
};

const getDailyStats = (base, quote, usdPrices, buckets) => {
  if (!buckets.length) return false;
  const volume = buckets.reduce((vol, itm) => parseInt(itm.base_volume, 10) + vol, 0);
  const baseVolume = precisedCount(volume, base.precision);
  const firstBucket = buckets[0];
  const lastBucket = buckets[buckets.length - 1];
  const firstBucketPrices = getPricesFromBucket(base.precision, quote.precision, firstBucket);
  const lastBucketPrices = getPricesFromBucket(base.precision, quote.precision, lastBucket);

  const priceDecrease = lastBucketPrices.close - firstBucketPrices.open;
  const change = priceDecrease * 100 / lastBucketPrices.close;

  return {
    baseVolume: +baseVolume.toFixed(base.precision),
    usdVolume: +(baseVolume / usdPrices.median).toFixed(2),
    price: lastBucketPrices.close,
    usdPrice: +(lastBucketPrices.close / usdPrices.last).toFixed(2),
    change24h: change.toFixed(2)
  };
};

const getMarketStats = async (baseAsset, usdAsset, quotes) => {
  quotes.unshift(usdAsset);
  const [usdResult, ...others] = await Promise.all(
    quotes.map((quote) => dailyStatsInHourBuckets(baseAsset, quote))
  );

  const usdFirstBucket = usdResult.data[0];
  const usdLastBucket = usdResult.data[usdResult.data.length - 1];
  const usdPrices = getUsdPrices(baseAsset.precision, usdAsset.precision, usdFirstBucket, usdLastBucket);

  return others.reduce((result, rawStat) => {
    result[rawStat.asset.symbol] = getDailyStats(baseAsset, rawStat.asset, usdPrices, rawStat.data);
    return result;
  }, {});
};

export default { getMarketStats };