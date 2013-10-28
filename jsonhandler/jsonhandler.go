package jsonhandler

import (
	"fmt"
	"io/ioutil"
	"net/http"
)

type JsonHandler struct {
	jiraUrl string
	login string
	password string
}

func NewJsonHandler(jiraUrl string, login string, password string) (*JsonHandler) {
	return &JsonHandler{jiraUrl, login, password}
}

func (handler *JsonHandler) ServeHTTP(writer http.ResponseWriter, req *http.Request) {
	issueId := req.URL.Path

	url := fmt.Sprintf("%s/rest/api/2/issue/%s/worklog", handler.jiraUrl, issueId)

	jiraReq := handler.createProxyRequest(url)

	doProxyRequest(writer, jiraReq)
}

func (handler *JsonHandler) createProxyRequest(url string) (req *http.Request) {
	req, err := http.NewRequest("GET",url, nil)
	if (err != nil) {
		return
	}
	req.SetBasicAuth(handler.login, handler.password)

	return req
}

func doProxyRequest(writer http.ResponseWriter, reqToProxy *http.Request) {
	client := &http.Client{}

	resp, err := client.Do(reqToProxy)
	if (err != nil) {
		return
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)

	if (err != nil) {
		return
	}

	fmt.Fprintf(writer, "%s", body)
}
