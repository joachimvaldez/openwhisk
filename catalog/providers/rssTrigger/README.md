### RSS
Hey Carlos, feel free to review this and share with the team.
My biggest issue with it is that I couldn't figure out how to run just open and not blue, so even though the package is in open, it requires blue (and has an ugly reference to blue in line 5 in `open/catalog/providers/rssTrigger/build.xml`). So yeah, that's a major issue.

Anyway, since I'm going off to vacation tomorrow (Wednesday, May 11) and Cloud Foundry after that, I probably won't be able to look at it again after today. It basically works, but the build process issues are something that I didn't resolve. And there are questions about how often to poll, what to do when an invalid RSS URL isn't provided, that still need to be answered. You should see TODOs.

I'm using node-feedparser [here](https://github.com/BiteBit/node-feedparser). There is this one [here](https://github.com/danmactough/node-feedparser) that I tried using, but it was not working when running on the server. It would parse the first item, but the stream would "end" reading after that.

### My branches

See RSS branch here: [Blue](https://github.ibm.com/valdezj/bluewhisk/tree/rss)

See RSS branch here: [Open](https://github.com/joachimvaldez/openwhisk/tree/rss)

### Testing
```
# Start docker-machine whisk
docker-machine start whisk

# SUBSTITUTE YOUR OWN PATH TO OPEN AND BLUE
# Build open
(cd ~/code/bluewhisk/open && gradle catalog:providers:rssTrigger:distDocker)

# Deploy blue
(cd ~/code/bluewhisk/blue && gradle distDocker && ant redeploy && ant postDeploy)


# Create feed
wsk trigger create nyt --feed /whisk.system/rss/rss -p rss_feed "http://rss.nytimes.com/services/xml/rss/nyt/US.xml"

# Delete feed
wsk trigger delete nyt

# You can check your "provider" code is running by looking at the rssTrigger provider logs
# Check your whisk.properties file for whisk.logs.dir property. That is where logs are stored. I run
cat /Users/Shared/wsklogs/rssTrigger/rssTrigger_logs.log
```
