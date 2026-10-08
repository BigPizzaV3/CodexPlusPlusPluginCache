# Reproduction and Baselines

## Reproduction quality

A good reproduction is:

- minimal
- repeatable
- observable
- environment-specific where necessary
- independent of irrelevant state
- documented precisely

## Baseline capture

Before editing, record:

- Unity version
- package versions
- platform
- scene
- prefab or object
- current Console messages
- current failing tests
- current serialized values
- Git commit
- reproduction frequency
- required timing
- representative data

## Intermittent failures

For intermittent bugs, record:

- number of attempts
- success and failure count
- timing windows
- machine or device
- frame rate
- network latency
- scene transition sequence
- input sequence

## Regression range

When Git history is available:

- identify last known good version
- identify first known bad version
- inspect relevant diffs
- use bisection when practical

Do not assume the most recent related-looking change caused the defect.

## Failed reproduction

When reproduction fails:

- compare environment
- compare data
- compare active scene and prefab
- compare project settings
- compare package versions
- compare domain reload settings
- compare networking topology
- compare hardware and platform

Do not modify code solely because the report sounds plausible.
