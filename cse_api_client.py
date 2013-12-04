#!/usr/bin/env python
#
# Client for unofficial CSE API.

import cookielib
import json
import logging
import urllib
import urllib2
import urlparse

import config

obf_gaia_id = "009070735501129361962"
cse_id = "wadxjqrcyas"
cx = obf_gaia_id + ":" + cse_id

cookie_jar = cookielib.LWPCookieJar()

class AuthRedirectHandler(urllib2.HTTPRedirectHandler):
    def http_error_302(self, req, fp, code, msg, headers):
        if not "location" in headers:
            return

        location = headers.getheaders("location")[0]
        logging.info("Redirect %s -> %s", req.get_full_url(), location)
        if location.startswith("https://www.google.com/accounts/ServiceLogin"):
            response = self.authenticate(req.get_full_url())
            return response

        return urllib2.HTTPRedirectHandler.http_error_302(
            self, req, fp, code, msg, headers)

    def authenticate(self, redirect_url):
        """Three step process to authenticate as a real user."""
        # Step 1 - ClientLogin
        fields = {
            "Email": config.cse_user,
            "Passwd": config.cse_pass,
            "service": "cprose"
            }
        response = self.parent.open(urllib2.Request(
            url="https://accounts.google.com/accounts/ClientLogin",
            data=urllib.urlencode(fields)))

        # Step 2 - IssueAuthToken
        target_fields = [ "SID", "LSID" ]
        fields = {
            "service": "gaia"
        }
        for line in response.read().split():
            k, v = line.split("=")
            if k in ["SID", "LSID"]:
                fields[k] = v
        response = self.parent.open(urllib2.Request(
            url="https://accounts.google.com/accounts/IssueAuthToken",
            data=urllib.urlencode(fields)))

        # Step 3 - TokenAuth followed by a bunch of redirects (automatically)
        fields = {
            "auth": response.read().rstrip(),
            "service": "cprose",
            "continue": redirect_url
        }
        response = self.parent.open(urllib2.Request(
            url="https://accounts.google.com/accounts/TokenAuth",
            data=urllib.urlencode(fields)))

        # The CheckCookie page has a <meta> redirect which we assume is taking
        # us to our desired location.
        if response.geturl().startswith("https://accounts.google.com/CheckCookie"):
            response = opener.open(redirect_url)

        return response


opener = urllib2.build_opener(AuthRedirectHandler,
                              urllib2.HTTPCookieProcessor(cookie_jar))
xsrf_token = None
def clear_xsrf_token():
    global xsrf_token
    xsrf_token = None

def get_xsrf_token():
    global xsrf_token
    if xsrf_token:
        return xsrf_token

    xsrf_url = "https://www.google.com/cse/setup/basic?cx=" + cx
    response = opener.open(xsrf_url)

    # ugly hack parsing
    html = response.read()
    magic = "var annotationsXsrf='"
    index_a = html.find(magic)
    if index_a == -1:
        raise Exception("Failed to get XSRF token %s" % response.geturl())

    index_a += len(magic)
    index_b = html.find("'", index_a)
    xsrf_token = html[index_a:index_b]
    logging.info("Got XSRF token: " + xsrf_token)
    return xsrf_token

def add_remove_labels_request(label):
    host = urlparse.urlparse(label.url).netloc + "/*"
    headers = {"Content-type": "application/json"}
    if label.mode == "site":
        about = host
    else:
        about = label.url

    request = {}
    adds = []
    for label_id in label.add:
        adds.append({
            "about": about,
            "label": [{"name": "_cse_" + cse_id}, {"name": label_id}]
        })

    removes = get_annotations_for_removal(label)

    data = json.dumps({
        "Add": { "Annotations": { "Annotation": adds }},
        "Remove": { "Annotations": { "Annotation": removes }}
    })

    api_url = ("https://www.google.com/cse/api/%s/annotations/%s?xsrf=%s"
           % (obf_gaia_id, cse_id, get_xsrf_token()))
    return urllib2.Request(api_url, data, headers)

def get_annotations_for_removal(label):
    # Short-circuit in case of nothing to remove
    if not label.remove:
        return []

    result = opener.open(get_labels_request(label))
    result_json = json.load(result)

    remove_dict = {}
    for label_id in label.remove:
        remove_dict[label_id] = True

    remove = []
    for annotation in result_json["Annotation"]:
        for label_json in annotation["Label"]:
            if label_json["name"] in remove_dict:
                remove.append(annotation)
    return remove

def get_labels_request(label):
    host = urlparse.urlparse(label.url).netloc
    headers = {"Accept": "application/json"}
    api_url = ("https://www.google.com/cse/api/%s/annotations/%s?xsrf=%s&url=%s"
               "&label=_cse_%s" %
               (obf_gaia_id, cse_id, get_xsrf_token(), host, cse_id))
    return urllib2.Request(api_url, headers=headers)

def add_remove_labels(label):
    num_tries = 2
    for i in range(num_tries):
        try:
            result = opener.open(add_remove_labels_request(label))
            # Success
            return
        except urllib2.HTTPError as e:
            # On a 400, try to refresh the XSRF token and retry
            if e.code == 400 and i != num_tries - 1:
                logging.info("Got 400 when POSTing label, retrying")
                clear_xsrf_token()
                continue

            # On any other error give up
            raise e
