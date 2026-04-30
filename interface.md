# Interface

This document describes the communication layer used to interface between with between the UI and micro3 process

## TX

Send out `cmd.h` interface for easy renderer-side interpretation

- initiator: `!`

Note that all commands are treated as "requests", with each being assigned a rid \[0, 63\]. Request responses are expected to return a packet with a header of `rid + 128` on success and `rid + 192` on failure, to allow responses to identify their caller.

### obj

`!obj <rid> <action> ...`

Available actions:

- create
    - Create a new object in the scene.
    - Returns the id of the new object
    - Errors if unable to create object
- destroy `id`
    - Destroy some object `id`, freeing the slot up for some other object.
    - Errors if unable to find object to free
- parent `id, parent`
    - Set the parent object of this object
    - If `parent` is not given or is the same as `id`, the object's parent is reset to the origin
    - Errors if unable to find object or parent object
- pos `id, x, y, z`
    - Set the position of some object `id`
    - Errors if unable to find object
- pivot `id, x, y, z, w`
    - Set the position of some object
    - Errors if unable to find object
- visible `id, visible`
    - Set the position of some object
    - Errors if unable to find object
- rlock `id, -xyz`
    - Set the r(otation) lock data of some object
    - Errors if unable to find object

- clear `id`
    - Clear the segment memory of an object
    - Errors if unable to find the object

### seg

`!seg <rid> <action> <objId> ...`

Avaialble actions:

- segment
    - Create a new segment within an object
    - Returns the id of the new segment within the object
    - Errors if unable to find object/allocate space for the segment
- offset `id, x, y, z`
    - Set the offset of this segment
    - Errors if unable to find the segment or its parent object
- absolute `id, absolute`
    - Set whether this segment is positioned relatively or absolutely
    - Errors if unable to find the segment or its parent object
- color `id`
    - Set the color of this segment. Allowed values are:
        - 0: M3_COLOR_INVISIBLE
        - 1: M3_COLOR_DARK
        - 2: M3_COLOR_DIM
        - 3: M3_COLOR_FULL
    - Errors if unable to find the segment or its parent object

### cam

`!cam <rid> <action> ...`

- pos `x, y, z`
    - Set the position of the main camera
- pivot `x, y, z, w`
    - Set the rotation of the main camera

## RX

Packets are received in the following format: `HEADER (1B)` - `BODY (1B / 1024B)`

Below are the important header values:

- 0: Frame packet: Contains data to render to the screen
    - 1024B body
- 128 - 191: Success packet: Indicates successful command operation
    - 1B status body
- 192 - 255: Failure packet: Indicates failure to execute command
    - 1B status body
