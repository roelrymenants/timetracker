package main

import (
	"github.com/roelrymenants/timetracker/jsonhandler"
	"github.com/roelrymenants/timetracker/config"
	"flag"
	"fmt"
	"log"
	"net/http"
)

func prepareFlags(configPath *string) {
	flag.StringVar(configPath, "config", "config.json", "Path to config.json file (e.g. /home/foo/bar/config.json)")

	flag.Parse()
}

func main() {
	var configPath string
	prepareFlags(&configPath)

	configuration := config.LoadConfig(configPath)

	httpAddress := fmt.Sprintf("%s:%s", configuration.Http.Host, configuration.Http.Port)

	http.Handle(configuration.AppRoot, http.StripPrefix(configuration.AppRoot, http.FileServer(http.Dir(configuration.WebRoot))))
	http.Handle(configuration.JsonRoot, http.StripPrefix(configuration.JsonRoot ,jsonhandler.NewJsonHandler(configuration.Jira.Url, configuration.Jira.Login, configuration.Jira.Password)))

	log.Fatal(http.ListenAndServe(httpAddress, nil))
}
