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

var papersAdded = 0;

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

function addPaper(paper, callback) {
  console.log('adding paper');
  if(paper && paper.id) {
    paper._id = paper.id;
    collection.find({"_id" : paper.id}).limit(1).toArray(function(err, docs){
      if(!docs.length){
        console.log('paper does not exist with id: '+ paper.id)
        collection.insert(paper, function(){
          callback(true);
        });
        newEntries++;
      } else {
        console.log('paper exists with id: ' + paper.id);
        existingEntries++;
          callback(false);
      }
    });
  } else {
    console.log('FATAL: no id for paper');
  }
}

function addPapers(papers, callback){
  var pCount = 0;
  var totalAdded = papers.length;
  console.log('adding '+ papers.length +' papers…');

  function processPaper(paper){
      addPaper(paper, function(wasAdded){
        if(!wasAdded){
          totalAdded--;
        }
        pCount++;
        if(papers[pCount]){
          processPaper(papers[pCount])
        } else {
          if(totalAdded > 0){
            papersAdded+=totalAdded;
            console.log(totalAdded + ' papers added.');
          }
          callback();
        }
      });
  }
  processPaper(papers[0]);
}

function gatherPapers(){

  var baseURL = "http://philpapers.org/asearch.pl?searchStr=Lewis%2C+David&&filterMode=authors&format=json"
  var totalProcessed = 0;
  var allPapers = [];

  function getResults(offset){
    var philurl = baseURL+"&start="+offset;
    request(philurl, function(error, response, json){

        if(!error){
            var data = JSON.parse(json);
            for (var i = 0; i< data.content.length; i++) {
              allPapers.push(data.content[i]);
              totalProcessed++;
            }
            if(totalProcessed < parseInt(data.found, 10)){
              getResults(offset+50);
            } else {
              console.log(allPapers.length + ' paper to process!');
              addPapers(allPapers);
            }
        }
    });
  }
  getResults(0);
}

function getAllCitations(ID, callback){
  var citeIDs = [];
  function getCitations(ID, offset){
    var url = citeURL+"&start="+offset+"&eId="+ID;
    console.log(ID + '+ getting citations at - ' + url);
    request(url, function(error, response, json){
        if(!error){
            var data = JSON.parse(json);
            if(data.content.length > 0) {
              console.log(ID+': processing '+ data.content.length +' results');
              for (var i = 0; i< data.content.length; i++) {
                citeIDs.push(data.content[i].id);
              }
              console.log(ID+': adding '+ data.content.length +' papers');
              addPapers(data.content, function(){
                if(data.content.length === 50){
                  console.log(ID+': get next page of citations');
                  getCitations(ID, offset+50);
                } else {
                  updatePapersCitations(ID, citeIDs, callback);
                }
              });
            } else {
              updatePapersCitations(ID, citeIDs, callback);
            }
        }
    });
  }
  getCitations(ID, 0);
}

function updatePapersCitations(ID, cites, callback){
  console.log(ID+': updating citations for');

  collection.update({ "_id" : ID }, {$set: {
    "citedby" : cites,
    "citeProcessed" : true
  }}, function(err, result){
    callback();
  })

}
function processPaperCitations(){
  papersPerMinute();
  connectToServer(function(){
      collection.find({ citeProcessed: { $ne: true } }).toArray(function(err, docs){
        if(!docs.length) {
          console.log('no docs');
        } else {
          processAllPapersCitations(docs, 0)
        }
    });
  });

}

 function processAllPapersCitations(docs, i){
   if(docs[i]) {
     var paper = docs[i];
     console.log(paper.id+': processing citations');
     if(!paper.citeProcessed) {
       unprocessedEntries++;
        console.log(paper.id+': needs processing');
       getAllCitations(paper.id, function(){
         processAllPapersCitations(docs, ++i);
       });

     } else {
       processedEntries++;
       processAllPapersCitations(docs, ++i);
     }
   } else {
     console.log(processedEntries + ' processed papers');
     console.log(unprocessedEntries + ' unprocessed papers');
     db.close();
   }
 }

 function markAllAsUnprocessed(){
   connectToServer(function(){
           collection.update({}, {$set: {
             "citeProcessed" : false
           }}, {multi:true}, function(err, result){
             console.log('all records marked as unprocessed');
             db.close();
           });
     });
 }

 function getDBstatus(){
   connectToServer(function(){
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
               db.close();
             }
         });
     });
 }

function papersPerMinute(){
  setInterval(function(){
    console.log('rate ppm ' + papersAdded);

    papersAdded = 0;
  }, 60000);
}

processPaperCitations();
