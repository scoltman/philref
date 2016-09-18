var mongodb = require('mongodb');
var request = require('request');

var MongoClient = mongodb.MongoClient;

var config = require('./config')
var url = config.url;
var db, collection;


function connectToServer(callback){
  MongoClient.connect(url, function (err, mdb) {
    db = mdb;
    if (err) {
      console.log('could not connect', err);
    } else {
      collection = db.collection('papers');
      callback();
    }
  });
}


connectToServer(function(){
  collection.aggregate([{$unwind: "$citedby"},
  {$group: {_id:"$_id", citedby: {$push:"$citedby"}, size: {$sum:1}}},
  {$sort:{size:-1}}]).limit(10).forEach(function(group){
    console.log(group._id +": " + group.size);
    db.close();
  });
});
