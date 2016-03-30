var moment = require("moment");
var elasticsearch = require("elasticsearch");

var excludedIndices = (process.env.EXCLUDED_INDICES || ".kibana").split(/[ ,]/).filter(isPresent);
var endpoint = process.env.ENDPOINT;
var indexDate = moment.utc().subtract(+(process.env.MAX_INDEX_AGE || 14), 'days');

exports.handler = function(event, context) {
  var client = new elasticsearch.Client({
    host: endpoint
  });

  client.indices.getAliases().then(function(results) {
    var indices = Object.keys(results);
    var worklist = indices.filter(function(index) {
      return !isExcluded(index) && isTooOld(index);
    });

    if (worklist.length > 0) {
      client.indices.delete({index: worklist}).then(function(results) {
        context.succeed('Successfully deleted indices ' + results);
      }, function(err) {
        context.fail('Failed to delete indices ' + err);
      });
    } else {
      context.succeed('No indices to delete.');
    }
  }, function(err) {
    context.fail('Failed to retrieve indices ' + err);
  })
};

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
