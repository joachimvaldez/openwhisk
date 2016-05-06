#!/bin/bash
#
# use the command line interface to install RSS package.
#

: ${WHISK_SYSTEM_AUTH:?"WHISK_SYSTEM_AUTH must be set and non-empty"}
AUTH_KEY=$WHISK_SYSTEM_AUTH

SCRIPTDIR="$(cd $(dirname "$0")/ && pwd)"
CATALOG_HOME=$SCRIPTDIR
source "$CATALOG_HOME/util.sh"

RSS_HOST=`fgrep rss.host= ../whisk.properties | cut -d'=' -f2`
RSS_PORT=`fgrep rss.host.port= ../whisk.properties | cut -d'=' -f2`
RSS_PACKAGE_ENDPOINT=$RSS_HOST':'$RSS_PORT
echo '  rss trigger package endpoint:' $RSS_PACKAGE_ENDPOINT

echo Installing RSS package.

createPackage rss \
     -a description 'RSS utility' \
     -a parameters '[ {"name":"rss_feed", "required":true}  ]' \
     -p package_endpoint $RSS_PACKAGE_ENDPOINT \
     -p cron '' \
     -p trigger_payload ''

waitForAll
install "$CATALOG_HOME/rss/rss.js"      rss/rss \
     -a description 'Fire trigger when change in rss feed occurs' \
     -a feed true

waitForAll

echo RSS package ERRORS = $ERRORS
exit $ERRORS
