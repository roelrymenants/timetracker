package config

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
)

type Config struct {
	WebRoot string
	AppRoot string
	JsonRoot string
	Http HttpConfig
	Jira JiraConfig
}

type HttpConfig struct {
	Host string
	Port string
}

type JiraConfig struct {
	Url string
	Login string
	Password string
}

func (config *Config) readFrom(path string) (err error) {
	b, err := ioutil.ReadFile(path)
	if err != nil {
		fmt.Print("Error reading config file", err)
		return
	}
	fmt.Printf("%s",b);
	err = json.Unmarshal(b, &config)
	if err != nil {
		fmt.Print("bad json ", err)
	}
	return
}

func LoadConfig(configPath string) (config *Config) {
	config = &Config{}

	config.readFrom(configPath)

	return
}
