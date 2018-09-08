#! /bin/bash -ex

pushd emulator
cat > log4j2.xml <<- XML
<?xml version="1.0" encoding="UTF-8"?>
<Configuration status="fatal">
  <Appenders>
    <Console name="STDOUT" target="SYSTEM_OUT">
      <PatternLayout pattern="%d %-5p [%t] %C{2} (%F:%L) - %m%n"/>
    </Console>
    </Appenders>
  <Loggers>
    <Logger name="com.amazonaws.services.dynamodbv2.local" level="debug" />
    <Root level="debug">
      <AppenderRef ref="STDOUT"/>
    </Root>
  </Loggers>
</Configuration>
XML

zip -d DynamoDBLocal.jar log4j2.xml
zip -u DynamoDBLocal.jar log4j2.xml
rm log4j2.xml
popd
