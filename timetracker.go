package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
)

type Config struct {
	WebRoot string
}

func (config *Config) ReadFrom(path string) (err error) {
	b, err := ioutil.ReadFile(path)
	if err != nil {
		fmt.Print("Error reading config file", err)
		return
	}
	err = json.Unmarshal(b, &config)
	if err != nil {
		fmt.Print("bad json ", err)
	}
	return
}

func main() {
	var configPath string
	flag.StringVar(&configPath, "config", "config.json", "Path to config.json file (e.g. /home/foo/bar/config.json)")

	flag.Parse()

	config := &Config{}

	config.ReadFrom(configPath)

	fmt.Print(config.WebRoot)

	log.Fatal(http.ListenAndServe(":8090", http.FileServer(http.Dir(config.WebRoot))))
}
