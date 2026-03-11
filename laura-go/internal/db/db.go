package db

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

func GetDSN() string {
	user := os.Getenv("POSTGRES_USER")
	if user == "" {
		user = "laura"
	}
	password := os.Getenv("POSTGRES_PASSWORD")
	if password == "" {
		password = "laura_password"
	}
	host := os.Getenv("POSTGRES_HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	port := os.Getenv("POSTGRES_PORT")
	if port == "" {
		port = "5433"
	}
	dbName := os.Getenv("POSTGRES_DB")
	if dbName == "" {
		dbName = "laura_finance"
	}

	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", user, password, host, port, dbName)
}

func ConnectDB() error {
	dsn := GetDSN()

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return fmt.Errorf("error parsing db config: %v", err)
	}

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return fmt.Errorf("error connecting to db: %v", err)
	}

	Pool = pool
	return nil
}

func CloseDB() {
	if Pool != nil {
		Pool.Close()
	}
}
