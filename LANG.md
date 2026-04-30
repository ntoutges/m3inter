# Language Spec

Goals: Create thin layer of interaction with underlying hardware

## Required Concepts

- Variables (duh)

- Objects
    - Declaration
    - Removal
    - Parenting
    - Positioning
    - Rotation
    - Visibility
    - Rlock

- Segments in Objects
    - Declaration (within object)
    - Removal (from object)
    - Reordering (within object)
    - Positioning
    - Coloring
    - Absolute set ("$" notation?)

- Camera Movement
    - Positioning
    - Rotation

## Abstraction

Layers of removal from the actual spec

- Objects + Segemnts are objects
    - OOP easier in this scenario than arbitrary numbers
    - Mimics the underlying handle system

## Syntax

```

// Standard variable declaration
myVar = 10;

obj = OBJ( // Define object name `obj`
    x = SEG(myVar,0,0), FULL, // Define segment within object named `x`
    y = SEG(0,0,0), FULL,
), VEC(0,0,0), QUAT(1,0,0,0)

obj.pos(0,0,0);
obj.pivot(1,2,3,4);
obj.visible(false);
obj.rlock(true, true, false)

x.offset(1,2,3); // Relative positioning
x.offset$(1,2,3); // Absolute positioning
x.color(DIM);

cam.pos(0,0,0);
cam.pivot(1,2,3,4);

sleep(1000);

x_pos = 0;
repeat(x_pos, 0, 10), {
    x_pos = x_pos + 1;
    sleep(100);
    obj.position(x_pos, 0, 0)
};

while(x_pos > 0), {
    x_pos = x_pos - 1;
    sleep(100);
    obj.position(x_pos, 0, 0)
};

myFunc = fn(a, b, c), {
    obj.position(a, b, c);
    return 10;
};

x = myFunc(1,2,3);

// Destroy segment + object
x.destroy();
obj.destroy();

```

### Function Syntax

```
<symbol>(
    <arg>,
    ...
    <name> = <arg>,
    ...
), <iarg>, ...
```

Function call

All functions are called as a name with a set of parentheses, which accepts a set of arguments.
Within parentheses are positional and named arguments.
After parentheses may follow a set of special _unordered_ arguments. These are only used by internal functions.

Note that this ordering of positional -> named args is important, and that later named args override previous named and positional args

Note that internally, `args` and `iargs` receive semantic information about each parameter given (ie: pre-evaluation symbol/rvalue, symbol type, etc.), to allow for more complex meta commands (see fn/while/repeat)

```
<symbol> = fn(<symbol>, ...), {
    <statement>...
}
```

Function def

All functions are defined using the special `fn` function. Any number of unordered symbols may be passed into the args field, while a single iarg must be provided. The args act as the parameters passed into the statements as defined in the iargs field.

### Variable Syntax

```
<symbol> = <rvalue>
```

Variable definition

Notice that functions are a subset of variable definitions. Rvalues can be constants, variables, function evaluation results, or mathematical experssions.

Valid constants are in the following list

- number: `[+-]?(0x|0b|0)?[1-9]\d+(\.\d+)?`
- boolean: `true|false`
- string: `" ... "|' ... '`
- vec/quat/object/segment (Returned from VEC/QUAT/OBJ/SEG functions)
- camera (globally defined)

### Builtins

#### Functions

- `OBJ( <segments>, ... ), vec, quat`: Define a new object. Named segments that are passed in are defined as variables in the scope that called this function, to allow for easy object extraction.
- `SEG(x,y,z | vec), color`: Define a new segment with a RELATIVE offset (overridable via `.offset$`). Note that defined segments may only ever be assigned to a single object. If one attempts to assign a single segment to multilple objects, the operation will fail.
- `SEG$(x,y,z | vec), color`: Define a new segment with an ABSOLUTE offset (overridable via `.offset`). Note that defined segments may only ever be assigned to a single object. If one attempts to assign a single segment to multilple objects, the operation will fail.
- `VEC(x,y,z)`: Create a new 3d vector
- `QUAT(x,y,z,w)`: Create a new 4d quaternion. Values will be normalized s.t. the magnitude of the resulting quaternion is 1.

- `fn( <args>, ... ), { ...<statements> }`: Define a new function what accepts `<args>` as arguments that are defined within the local scope of `statements`: Assign the result of this function to a variable to enable later calling.
- `repeat( <symbol> , <start>, <end> ), { ...<statements> }`: Repeat some block of code some number of times. Accepts an iterator symbol whose value will reflect the current iteration
- `while( <condition> ), { ...<statements> }`: Repeat some block of code until the condition is no longer satisfied.

- `sleep( ms )`: Pause program execution for some number of milliseconds
- `queue( ms ), { ...<statements> }`: Split program execution into two paths:
    - The main path, where code continues executing immediately after the `queue` function
    - The secondary path, where the `statements` begin executing after the specified delay (in ms). (Acts like `setTimeout` )

#### Object Methods

- `parent(obj)`: Set the parent object of this object. Leave `obj` empty to reset the parent to the origin
- `pos(x, y, z)` | `pos(vec)`: Set the position of the object in worldspace. If given as positional arguments, axes not provided are unchanged
- `pivot(x, y, z, w)` | `pivot(quat)`: Set the rotation of the object in worldspace. If given as positional arguments, axes not provided default to 0, and the final quaternion is normalized
- `visible(<boolean>)`: Set the visibility of the object
- `rlock(x?, y?, z?)`: Set the rotation lock axes. If given as positional arguments, axes not provided are unchanged

#### Segment Methods

- `offset(x, y, z)` | `offset(vec)`: Set the offset of the segment in worldspace, relative to the previous. If given as positional arguments, axes not provided are unchanged
- `offset$(x, y, z)` | `offset$(vec)`: Set the offset of the segment in worldspace, relative to the object origin. If given as positional arguments, axes not provided are unchanged
- `color(FULL | DIM | DARK | INVISIBLE)`: Set the color of the segment

#### Camera Methods

- `pos(x, y, z)` | `pos(vec)`: Set the position of the camera in worldspace. If given as positional arguments, axes not provided are unchanged
- `pivot(x, y, z, w)` | `pivot(quat)`: Set the rotation of the camera in worldspace. If given as positional arguments, axes not provided default to 0, and the final quaternion is normalized
