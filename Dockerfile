FROM ruby:3.3-bookworm
WORKDIR /site
COPY Gemfile Gemfile.lock ./
RUN bundle install
EXPOSE 4000
CMD ["bundle", "exec", "jekyll", "serve", "--host", "0.0.0.0", "--config", "_config.yml,_config_docker.yml"]
