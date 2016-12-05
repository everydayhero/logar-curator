var _ = require('elasticsearch/src/lib/utils');
var elasticsearch = require('elasticsearch');
var moment = require('moment');

var apiVersion = process.env.API_VERSION;
var awsRegion = process.env.AWS_REGION;
var endpoint = process.env.ENDPOINT;
var excludedIndices = (process.env.EXCLUDED_INDICES || '.kibana').split(/[ ,]/);
var indexDate = moment.utc().subtract(+(process.env.MAX_INDEX_AGE || 14), 'days');

if (awsRegion !== undefined) {
  var AWS = require('aws-sdk');
}

exports.handler = function(event, context) {
  var config = {
    apiVersion: apiVersion,
    host: endpoint,
  };

  if (awsRegion !== undefined) {
    config = _.deepMerge(config, {
      amazonES: {
        credentials: new AWS.EnvironmentCredentials('AWS'),
        region: awsRegion,
      },
      connectionClass: require('http-aws-es'),
    });
  }

  var client = new elasticsearch.Client(config);

  getIndices(client)
    .then(extractIndices)
    .then(filterIndices)
    .then(deleteIndices(client))
    .then(report(context.succeed), context.fail);
}

function getIndices(client) {
  return client.indices.getAliases();
}

function extractIndices(results) {
  return Object.keys(results);
}

function filterIndices(indices) {
  return indices.filter(function(index) {
    return !isExcluded(index) && isTooOld(index);
  });
}

function deleteIndices(client) {
  return function(indices) {
    if (indices.length > 0) {
      return client.indices.delete({index: indices}).then(function() {
        return indices;
      });
    } else {
      return indices;
    }
  };
}

function report(cb) {
  return function(indices) {
    var len = indices.length;
    if (len > 0) {
      cb('Successfully deleted ' + len + ' indices: ' + indices.join(', '));
    } else {
      cb('There were no indices to delete.');
    }
  };
}

function isExcluded(indexName) {
  return excludedIndices.indexOf(indexName) !== -1;
}

function isTooOld(indexName) {
  var m = moment.utc(indexName, 'YYYY.MM.DD');
  return m.isBefore(indexDate);
}
