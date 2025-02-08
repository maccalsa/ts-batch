.PHONY: release

release:
	@echo "Fetching the latest tag..."
	@latest_tag=`git tag --sort=version:refname | tail -n1`; \
	echo "Latest tag: $$latest_tag"; \
	# Remove a leading 'v' if present, then split version into parts  
	version=$$(echo $$latest_tag | sed 's/^v//'); \
	major=$$(echo $$version | cut -d. -f1); \
	minor=$$(echo $$version | cut -d. -f2); \
	patch=$$(echo $$version | cut -d. -f3); \
	\
	# Determine new version based on TYPE parameter  
	if [ "$(TYPE)" = "major" ]; then \
	  major=$$((major + 1)); minor=0; patch=0; \
	elif [ "$(TYPE)" = "minor" ]; then \
	  minor=$$((minor + 1)); patch=0; \
	elif [ "$(TYPE)" = "patch" ]; then \
	  patch=$$((patch + 1)); \
	else \
	  echo "Unknown release type: $(TYPE). Use major, minor, or patch."; exit 1; \
	fi; \
	\
	new_tag="v$$major.$$minor.$$patch"; \
	echo "New tag: $$new_tag"; \
	\
	# Create an annotated tag and push it to GitHub  
	git tag -a $$new_tag -m "Release $$new_tag"; \
	git push origin $$new_tag
