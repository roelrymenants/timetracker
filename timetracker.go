package main

import (
	"log"
	"net/http"
)

func main() {
	log.Fatal(http.ListenAndServe(":8090", http.FileServer(http.Dir("../web"))))
}
