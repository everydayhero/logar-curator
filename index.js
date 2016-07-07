var moment = require("moment");
var elasticsearch = require("elasticsearch");

var isAWS = process.env.IS_AWS || false;
if (isAWS) var AWS = require('aws-sdk');
if (isAWS) var region = process.env.AWS_REGION || 'us-east-1';

var excludedIndices = (process.env.EXCLUDED_INDICES || ".kibana").split(/[ ,]/).filter(isPresent);
var endpoint = process.env.ENDPOINT;
var indexDate = moment.utc().subtract(+(process.env.MAX_INDEX_AGE || 14), 'days');

exports.handler = function(event, context) {
  var client;
  if (isAWS) {
    var myCredentials = new AWS.EnvironmentCredentials('AWS');
    console.log(myCredentials);
    client = new elasticsearch.Client({
      hosts: endpoint,
      connectionClass: require('http-aws-es'),
      amazonES: {
        region: region,
        credentials: myCredentials
      }
    });
  } else {
    client = new elasticsearch.Client({
      host: endpoint
    });
  }
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
      cb("Successfully deleted " + len + " indices: " + indices.join(", "));
    } else {
      cb("There were no indices to delete.");
    }
  };
}

function isExcluded(indexName) {
  return excludedIndices.indexOf(indexName) !== -1;
}

function isTooOld(indexName) {
  var m = moment.utc(indexName, "YYYY.MM.DD");
  return m.isBefore(indexDate);
}

function isPresent(item) {
  return item;
}
