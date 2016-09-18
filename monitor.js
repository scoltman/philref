var mongodb = require('mongodb');
var request = require('request');

var MongoClient = mongodb.MongoClient;

var config = require('./config')
var url = config.url;
var db, collection;
var newEntries = 0;
var existingEntries = 0;
var citeURL = "http://philpapers.org/asearch.pl?direction=citations&format=json"

var leftToProcess = [];

var processedEntries = 0;
var unprocessedEntries = 0;

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

 function getDBstatus(){
   var totalPapers = 1385199;
   var paperRate = 100;

   connectToServer(function(){
      setInterval(function(){
           collection.find().toArray(function(err, docs){
             if(!docs.length) {
               console.log('no docs');
             } else {
               console.log(docs.length+' papers');
               docs.forEach(function(doc){
                 if(doc.citeProcessed === true){
                   processedEntries++
                 } else {
                   unprocessedEntries++
                 }
               });

               console.log(processedEntries + ' processed papers');
               console.log(unprocessedEntries + ' unprocessed papers');
               console.log(Math.ceil(((totalPapers - docs.length)%paperRate)%60) + " hours");
               console.log('-----------');
               processedEntries =0;
               unprocessedEntries=0;

             }
         });
       }, 5000);
     });
 }

getDBstatus();
