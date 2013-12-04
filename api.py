#!/usr/bin/env python
#
# JSON APIs for genesearch app

import json
import webapp2

import cse_api_client

from google.appengine.ext import db

# models
class QueryLogEntry(db.Model):
    query = db.StringProperty()
    date = db.DateTimeProperty(auto_now_add=True)

# NOTE(mwytock): These are really deltas representing the labeling actions
class Label(db.Model):
    timestamp = db.DateTimeProperty(auto_now_add=True)
    url = db.StringProperty()
    add = db.StringListProperty()
    remove = db.StringListProperty()
    mode = db.CategoryProperty(choices=("page", "site"))

# handlers
class LogApi(webapp2.RequestHandler):
    def post(self):
        log_entry = QueryLogEntry(query=self.request.get("q"))
        log_entry.put()


class AllQueries(webapp2.RequestHandler):
    def get(self):
        self.response.headers["Content-type"] = "text/text"
        q = db.Query(QueryLogEntry).order("-date")

        seen_queries = {}
        for log_entry in q.run(limit=10000):
            if log_entry.query in seen_queries:
                continue
            self.response.out.write(log_entry.query + "\n")
            seen_queries[log_entry.query] = True


class RecentApi(webapp2.RequestHandler):
    def get(self):
        q = db.Query(QueryLogEntry).order("-date")

        seen_queries = {}
        recent = []
        for log_entry in q.run(limit=1000):
            if log_entry.query in seen_queries:
                continue
            recent.append({"query": log_entry.query})
            seen_queries[log_entry.query] = True
            if (len(seen_queries) > 30) :
                break
            
        self.response.headers["Cache-control"] = "no-store"
        self.response.headers["Content-type"] = "application/json"
        self.response.out.write(json.dumps({"recent": recent}))

class LabelApi(webapp2.RequestHandler):
    def post(self):
        label = Label(url=self.request.get("url"),
                      add=self.request.get_all("add"),
                      remove=self.request.get_all("remove"),
                      mode=self.request.get("mode"))
        label.put()
        cse_api_client.add_remove_labels(label)


app = webapp2.WSGIApplication([("/api/log", LogApi),
                               ("/api/recent", RecentApi),
                               ("/api/allQueries", AllQueries),
                               ("/api/label", LabelApi)])
